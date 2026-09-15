-- Keep copied line text on invoices when a price-list item is deleted.
ALTER TABLE "InvoiceLine" DROP CONSTRAINT IF EXISTS "InvoiceLine_itemId_fkey";
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
