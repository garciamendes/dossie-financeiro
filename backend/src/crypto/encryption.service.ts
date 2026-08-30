import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Criptografia de campo — SEGURANCA.md, seção 2.
 *
 * Não basta o disco do banco estar cifrado: campos críticos (saldo, número
 * de conta, segredo TOTP) são cifrados individualmente com AES-256-GCM.
 * Cada valor carrega seu próprio IV e a tag de autenticação (GCM detecta
 * adulteração). Formato guardado no banco: base64(iv).base64(tag).base64(ct)
 *
 * A chave-mestra vem de `FIELD_ENCRYPTION_KEY` (cofre de segredos / KMS),
 * nunca hardcoded, nunca versionada.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;
  private static readonly ALGO = 'aes-256-gcm';
  private static readonly IV_BYTES = 12;

  constructor(config: ConfigService) {
    const hexKey = config.getOrThrow<string>('FIELD_ENCRYPTION_KEY');
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plain: string): string {
    const iv = crypto.randomBytes(EncryptionService.IV_BYTES);
    const cipher = crypto.createCipheriv(EncryptionService.ALGO, this.key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString('base64'),
      tag.toString('base64'),
      ct.toString('base64'),
    ].join('.');
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, ctB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !ctB64) {
      throw new Error('Payload cifrado em formato inválido.');
    }
    const decipher = crypto.createDecipheriv(
      EncryptionService.ALGO,
      this.key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64')),
      decipher.final(),
    ]);
    return pt.toString('utf8');
  }

  // Açúcar para os campos que na prática guardam um inteiro em centavos.
  encryptInt(value: number): string {
    return this.encrypt(String(Math.trunc(value)));
  }

  decryptInt(payload: string | null | undefined): number {
    if (!payload) return 0;
    return parseInt(this.decrypt(payload), 10);
  }
}
