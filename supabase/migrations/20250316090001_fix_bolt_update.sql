/*
  # Naprawa funkcjonalności po aktualizacji przez bolt.new

  1. Przywrócone funkcjonalności:
    - Walidacja godzin pracy
    - Walidacja cen promocyjnych
    - Konto administratora
    - Brakujące triggery
*/

-- =========================================
-- Przywrócenie funkcji walidujących godziny pracy
-- =========================================

-- Recreate the check_working_hours function
CREATE OR REPLACE FUNCTION check_working_hours(check_time timestamptz)
RETURNS boolean AS $$
DECLARE
  local_time timestamptz;
  day_of_week integer;
  hour_of_day integer;
BEGIN
  -- Konwertuj czas na strefę czasową Warsaw
  local_time := check_time AT TIME ZONE 'Europe/Warsaw';
  
  -- Pobierz dzień tygodnia (1-7, gdzie 1 to poniedziałek)
  day_of_week := EXTRACT(DOW FROM local_time);
  IF day_of_week = 0 THEN day_of_week := 7; END IF;
  
  -- Pobierz godzinę
  hour_of_day := EXTRACT(HOUR FROM local_time);
  
  -- Sprawdź warunki
  RETURN CASE
    -- Poniedziałek-Piątek (1-5): 8:00-16:00
    WHEN day_of_week BETWEEN 1 AND 5 AND hour_of_day BETWEEN 8 AND 15 THEN true
    -- Sobota (6): 8:00-13:00
    WHEN day_of_week = 6 AND hour_of_day BETWEEN 8 AND 12 THEN true
    -- Niedziela (7): zamknięte
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql;

-- Recreate the validate_reservation function
CREATE OR REPLACE FUNCTION validate_reservation()
RETURNS TRIGGER AS $$
BEGIN
  -- Sprawdź godziny pracy dla początku i końca rezerwacji
  IF NOT check_working_hours(NEW.start_date) OR NOT check_working_hours(NEW.end_date) THEN
    RAISE EXCEPTION 'Reservation must be within working hours';
  END IF;

  -- Sprawdź czy data końcowa jest późniejsza niż początkowa
  IF NEW.end_date <= NEW.start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS validate_reservation_time_gap ON reservations;
CREATE TRIGGER validate_reservation_time_gap
  BEFORE INSERT OR UPDATE
  ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION validate_reservation();

-- Add constraints
DO $$ 
BEGIN
  -- Add constraints to reservations table if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'check_working_hours_start') THEN
    ALTER TABLE reservations
      ADD CONSTRAINT check_working_hours_start 
      CHECK (check_working_hours(start_date));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'check_working_hours_end') THEN
    ALTER TABLE reservations
      ADD CONSTRAINT check_working_hours_end 
      CHECK (check_working_hours(end_date));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'valid_dates') THEN
    ALTER TABLE reservations
      ADD CONSTRAINT valid_dates 
      CHECK (end_date >= start_date);
  END IF;
END $$;

-- =========================================
-- Przywrócenie funkcji walidujących ceny promocyjne
-- =========================================

-- Create function to validate promotional price
CREATE OR REPLACE FUNCTION validate_promotional_price()
RETURNS trigger AS $$
BEGIN
  IF NEW.promotional_price IS NOT NULL THEN
    IF NEW.promotional_price >= NEW.price THEN
      RAISE EXCEPTION 'Promotional price must be lower than regular price';
    END IF;
    IF NEW.promotional_price < 0 THEN
      RAISE EXCEPTION 'Promotional price cannot be negative';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate promotional price on insert/update if it doesn't exist
DROP TRIGGER IF EXISTS validate_promotional_price_trigger ON equipment;
CREATE TRIGGER validate_promotional_price_trigger
BEFORE INSERT OR UPDATE ON equipment
FOR EACH ROW
EXECUTE FUNCTION validate_promotional_price();

-- =========================================
-- Przywrócenie konta administratora
-- =========================================

-- Sprawdź i zaktualizuj uprawnienia administratora dla użytkownika biuro@solrent.pl
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Znajdź użytkownika po adresie email
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'biuro@solrent.pl';
  
  IF admin_user_id IS NULL THEN
    RAISE NOTICE 'Użytkownik biuro@solrent.pl nie istnieje. Tworzenie konta administratora wymaga klucza serwisowego.';
  ELSE
    -- Upewnij się, że użytkownik ma wpis w profiles z uprawnieniami administratora
    INSERT INTO public.profiles (id, email, is_admin, updated_at)
    VALUES (admin_user_id, 'biuro@solrent.pl', TRUE, now())
    ON CONFLICT (id) DO UPDATE 
    SET is_admin = TRUE, updated_at = now();
    
    RAISE NOTICE 'Uprawnienia administratora zostały przyznane dla użytkownika biuro@solrent.pl';
  END IF;
END $$; 