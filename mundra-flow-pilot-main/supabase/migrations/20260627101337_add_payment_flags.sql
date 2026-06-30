ALTER TABLE "public"."payments"
ADD COLUMN "is_utcl_payment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_advance" BOOLEAN NOT NULL DEFAULT false;
