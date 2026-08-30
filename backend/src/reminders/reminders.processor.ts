import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { REMINDERS_QUEUE, RemindersService, SCAN_JOB } from './reminders.service';

/**
 * Worker BullMQ que executa o scan agendado fora do ciclo de request da API
 * (PRD, seção 3: "não travar a API esperando resposta de IA/OCR" — aqui, não
 * travar a API rodando o scan de lembretes).
 */
@Processor(REMINDERS_QUEUE)
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(private reminders: RemindersService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === SCAN_JOB) {
      return this.reminders.scanAndSend(new Date());
    }
    this.logger.warn(`Job desconhecido na fila de lembretes: ${job.name}`);
    return null;
  }
}
