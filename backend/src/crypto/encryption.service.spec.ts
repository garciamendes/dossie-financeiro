import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

const KEY = 'a'.repeat(64); // 32 bytes em hex

function makeService(): EncryptionService {
  const config = {
    getOrThrow: (k: string) => {
      if (k === 'FIELD_ENCRYPTION_KEY') return KEY;
      throw new Error(`config ${k} não definido`);
    },
  } as unknown as ConfigService;
  return new EncryptionService(config);
}

describe('EncryptionService (AES-256-GCM de campo)', () => {
  const svc = makeService();

  it('faz round-trip de string', () => {
    const payload = svc.encrypt('12345-6');
    expect(payload).not.toContain('12345-6');
    expect(svc.decrypt(payload)).toBe('12345-6');
  });

  it('faz round-trip de inteiro (centavos)', () => {
    const payload = svc.encryptInt(-4210);
    expect(svc.decryptInt(payload)).toBe(-4210);
  });

  it('trata null/undefined como zero', () => {
    expect(svc.decryptInt(null)).toBe(0);
    expect(svc.decryptInt(undefined)).toBe(0);
  });

  it('gera IV diferente a cada chamada (mesmo texto, ciphertext distinto)', () => {
    expect(svc.encrypt('igual')).not.toBe(svc.encrypt('igual'));
  });

  it('rejeita payload adulterado (GCM auth tag)', () => {
    const [iv, tag, ct] = svc.encrypt('sensível').split('.');
    const flipped = Buffer.from(ct, 'base64');
    flipped[0] ^= 0xff;
    const tampered = [iv, tag, flipped.toString('base64')].join('.');
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it('rejeita payload em formato inválido', () => {
    expect(() => svc.decrypt('não-tem-pontos')).toThrow(/formato inválido/);
  });
});
