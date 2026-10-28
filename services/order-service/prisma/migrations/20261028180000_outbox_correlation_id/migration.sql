-- Rastreabilidade distribuída: o X-Correlation-ID acompanha o evento da outbox até o broker
ALTER TABLE "outbox" ADD COLUMN "correlationId" TEXT;
