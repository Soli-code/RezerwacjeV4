/*
  # Naprawa funkcjonalności triggerów auth
  
  1. Przywrócone funkcjonalności:
    - Funkcja obsługująca nowych użytkowników z modyfikatorem SECURITY DEFINER
    - Funkcja do ustawiania uprawnień administratora z modyfikatorem SECURITY DEFINER
    - Trigger na tabeli auth.users
*/

-- Funkcja obsługująca nowych użytkowników
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin)
  VALUES (new.id, new.email, false)
  ON CONFLICT (id) DO UPDATE 
  SET email = new.email, updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger na tabeli auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Funkcja do ustawiania uprawnień administratora
CREATE OR REPLACE FUNCTION public.set_admin_privileges(user_email TEXT, is_admin_value BOOLEAN)
RETURNS BOOLEAN AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Znajdź użytkownika po email
  SELECT id INTO user_id FROM auth.users WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Aktualizuj lub utwórz wpis w profiles
  INSERT INTO public.profiles (id, email, is_admin, updated_at)
  VALUES (user_id, user_email, is_admin_value, now())
  ON CONFLICT (id) DO UPDATE 
  SET is_admin = is_admin_value, updated_at = now();
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ustaw uprawnienia administratora dla użytkownika biuro@solrent.pl
SELECT public.set_admin_privileges('biuro@solrent.pl', true); 