ALTER TABLE "Account" ADD COLUMN "packCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Account" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Account" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "Account" ADD COLUMN "billingInterval" TEXT NOT NULL DEFAULT 'month';
ALTER TABLE "Account" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'SGD';

CREATE UNIQUE INDEX "Account_stripeSubscriptionId_key" ON "Account"("stripeSubscriptionId");

ALTER TABLE "User" ADD COLUMN "isMainAdmin" BOOLEAN NOT NULL DEFAULT false;
