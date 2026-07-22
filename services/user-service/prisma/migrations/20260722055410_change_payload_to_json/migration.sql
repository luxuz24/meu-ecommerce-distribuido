/*
  Warnings:

  - Changed the type of `payload` on the `outbox` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "outbox" DROP COLUMN "payload",
ADD COLUMN     "payload" JSONB NOT NULL;
