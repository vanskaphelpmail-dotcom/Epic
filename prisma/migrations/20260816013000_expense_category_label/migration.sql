-- Store the human-readable expense category while keeping the existing enum.
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "categoryLabel" TEXT;
