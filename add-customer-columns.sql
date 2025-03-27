-- Dodanie brakujących kolumn do tabeli customers
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS street text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS company_nip text; 