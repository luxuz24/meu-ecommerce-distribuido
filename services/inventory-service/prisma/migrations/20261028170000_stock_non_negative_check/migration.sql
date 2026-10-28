-- Última linha de defesa contra overselling: o banco recusa saldo negativo,
-- mesmo que algum caminho de código futuro esqueça o decremento condicional.

-- Saneia dados de ambientes de demonstração afetados pelo bug anterior
UPDATE "inventory_items" SET "availableQty" = 0 WHERE "availableQty" < 0;
UPDATE "inventory_items" SET "reservedQty" = 0 WHERE "reservedQty" < 0;

ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_available_qty_non_negative" CHECK ("availableQty" >= 0),
  ADD CONSTRAINT "inventory_items_reserved_qty_non_negative" CHECK ("reservedQty" >= 0);
