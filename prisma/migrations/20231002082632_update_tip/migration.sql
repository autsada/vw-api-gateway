-- AlterTable
ALTER TABLE "Tip" ALTER COLUMN "from" DROP NOT NULL,
ALTER COLUMN "to" DROP NOT NULL,
ALTER COLUMN "amount" DROP NOT NULL,
ALTER COLUMN "fee" DROP NOT NULL;
