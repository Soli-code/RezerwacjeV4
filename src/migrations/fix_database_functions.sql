-- Migracja naprawiająca funkcje i triggery związane z problemami autoryzacji
-- Ten skrypt należy uruchomić w panelu SQL Supabase

-- Najpierw usuń problematyczne polityki, które powodują rekurencję
DROP POLICY IF EXISTS "Administratorzy mają pełny dostęp do profili" ON profiles;
DROP POLICY IF EXISTS "Administratorzy mają pełny dostęp do sprzętu" ON equipment;

-- Funkcja sprawdzająca uprawnienia administratora
CREATE OR REPLACE FUNCTION public.check_is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = user_id AND is_admin = true
  );
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Błąd w funkcji check_is_admin: %', SQLERRM;
    RETURN false;
END;
$$;

-- Funkcja obsługująca autoryzację dla niektórych tabel
CREATE OR REPLACE FUNCTION public.authorize_admin_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  requesting_user_id uuid;
BEGIN
  -- Pobierz ID bieżącego użytkownika
  requesting_user_id := auth.uid();
  
  -- Sprawdź, czy użytkownik jest administratorem
  SELECT public.check_is_admin(requesting_user_id) INTO is_admin;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Dostęp zabroniony: wymagane uprawnienia administratora';
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Błąd w funkcji authorize_admin_action: %', SQLERRM;
    RAISE EXCEPTION 'Błąd autoryzacji: %', SQLERRM;
END;
$$;

-- Funkcja do logowania działań w systemie
CREATE OR REPLACE FUNCTION public.log_auth_event(event_type text, user_id uuid, details jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO auth_logs (event_type, user_id, details, created_at)
  VALUES (event_type, user_id, details, now());
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Błąd w funkcji log_auth_event: %', SQLERRM;
END;
$$;

-- Upewnij się, że tabela auth_logs istnieje
CREATE TABLE IF NOT EXISTS public.auth_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Usuń istniejące triggery, jeśli istnieją, aby uniknąć duplikacji
DROP TRIGGER IF EXISTS authorize_admin_trigger ON profiles;
DROP TRIGGER IF EXISTS authorize_admin_trigger ON equipment;
DROP TRIGGER IF EXISTS authorize_admin_trigger ON reservations;

-- Dodaj triggery autoryzacji do ważnych tabel
CREATE TRIGGER authorize_admin_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
WHEN (OLD.is_admin IS DISTINCT FROM NEW.is_admin)
EXECUTE FUNCTION authorize_admin_action();

CREATE TRIGGER authorize_admin_trigger
BEFORE UPDATE OR DELETE ON equipment
FOR EACH ROW
EXECUTE FUNCTION authorize_admin_action();

-- Dodaj uprawnienia RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Dodaj NOWE polityki dostępu bez rekurencji
CREATE POLICY "Administratorzy mają pełny dostęp do profili"
ON profiles FOR ALL
TO authenticated
USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
WITH CHECK (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Administratorzy mają pełny dostęp do sprzętu"
ON equipment FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)); 