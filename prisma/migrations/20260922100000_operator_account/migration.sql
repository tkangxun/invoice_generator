-- One operator account owns every company and person already on the app.
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "exempt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Account" ("id", "exempt", "createdAt")
VALUES ('acc_operator', true, CURRENT_TIMESTAMP);

ALTER TABLE "User" ADD COLUMN "accountId" TEXT;
ALTER TABLE "Company" ADD COLUMN "accountId" TEXT;

UPDATE "User" SET "accountId" = 'acc_operator';
UPDATE "Company" SET "accountId" = 'acc_operator';

ALTER TABLE "User" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "accountId" SET NOT NULL;

DROP INDEX "User_email_key";
DROP INDEX "Company_name_key";

CREATE UNIQUE INDEX "User_accountId_email_key" ON "User"("accountId", "email");
CREATE UNIQUE INDEX "Company_accountId_name_key" ON "Company"("accountId", "name");
CREATE INDEX "User_accountId_idx" ON "User"("accountId");
CREATE INDEX "Company_accountId_idx" ON "Company"("accountId");

ALTER TABLE "User" ADD CONSTRAINT "User_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Company" ADD CONSTRAINT "Company_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
