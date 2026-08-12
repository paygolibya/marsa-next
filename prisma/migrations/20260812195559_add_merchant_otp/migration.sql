-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "otp_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otp_code_hash" TEXT,
ADD COLUMN     "otp_expires_at" TIMESTAMP(3),
ADD COLUMN     "otp_sent_at" TIMESTAMP(3),
ADD COLUMN     "phone_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registration_ip" TEXT;

-- Backfill: merchants that existed before phone verification shipped were
-- already using the app — don't retroactively lock them out. Only new
-- registrations (inserted after this migration runs) start at false.
UPDATE "merchants" SET "phone_verified" = true;
