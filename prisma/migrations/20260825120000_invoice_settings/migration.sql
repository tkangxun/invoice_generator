-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "uen" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "paymentTerms" TEXT NOT NULL,
    "logoMime" TEXT,
    "logoBytes" BYTEA,
    "paynowQrMime" TEXT,
    "paynowQrBytes" BYTEA,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");
