-- Reservas passam a ter prazo: sem isso, uma etapa que nunca responde (ex.: mensagem do
-- pagamento na DLQ) prende o estoque para sempre.
ALTER TABLE "stock_reservations" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "stock_reservations" ADD COLUMN "correlationId" TEXT;

-- Reservas antigas ainda abertas ganham prazo a partir de agora
UPDATE "stock_reservations" SET "expiresAt" = NOW() + INTERVAL '15 minutes'
 WHERE "status" = 'RESERVED' AND "expiresAt" IS NULL;

CREATE INDEX "stock_reservations_status_expiresAt_idx" ON "stock_reservations"("status", "expiresAt");
