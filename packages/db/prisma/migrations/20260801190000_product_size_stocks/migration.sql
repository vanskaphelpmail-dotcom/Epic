-- Per-size inventory map on products (e.g. {"S":2,"M":5,"XL":0})
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sizeStocks" JSONB;
