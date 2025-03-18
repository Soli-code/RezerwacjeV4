-- Skrypt SQL do naprawy konta administratora (poprawiona wersja)
-- Wykonaj to w SQL Editor w panelu Supabase: https://supabase.com/dashboard/project/klumxecllfauamqnrckf

-- 1. Sprawdź, czy tabela profiles istnieje, jeśli nie - utwórz ją
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Dodaj kolumnę is_admin, jeśli nie istnieje
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END
$$;

-- 3. Sprawdź, czy tabela admin_actions istnieje, jeśli nie - utwórz ją
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id SERIAL PRIMARY KEY,
  action_type TEXT NOT NULL,
  action_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Ustaw odpowiednie uprawnienia dla tabeli profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Usuń istniejącą politykę (jeśli istnieje)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_policies
    WHERE tablename = 'profiles' 
    AND policyname = 'Administratorzy mają pełny dostęp do profili'
  ) THEN
    DROP POLICY "Administratorzy mają pełny dostęp do profili" ON public.profiles;
  END IF;
END
$$;

-- 6. Utwórz politykę dla administratorów (bez IF NOT EXISTS)
CREATE POLICY "Administratorzy mają pełny dostęp do profili" 
ON public.profiles 
FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = TRUE)
);

-- 7. Dodaj użytkownika admina do tabeli profiles
-- To zadziała tylko jeśli użytkownik biuro@solrent.pl już istnieje w auth.users
INSERT INTO public.profiles (id, email, is_admin)
SELECT id, email, TRUE
FROM auth.users
WHERE email = 'biuro@solrent.pl'
ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;

-- 8. Jeśli poprzednie zapytanie nie dodało żadnych wierszy, dodaj dodatkową politykę
-- która pozwoli wszystkim użytkownikom na pierwsze logowanie
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM public.profiles WHERE is_admin = TRUE) THEN
    IF EXISTS (
      SELECT FROM pg_policies
      WHERE tablename = 'profiles' 
      AND policyname = 'Wszyscy użytkownicy mogą odczytywać swoje profile'
    ) THEN
      DROP POLICY "Wszyscy użytkownicy mogą odczytywać swoje profile" ON public.profiles;
    END IF;
    CREATE POLICY "Wszyscy użytkownicy mogą odczytywać swoje profile" 
    ON public.profiles 
    FOR SELECT USING (
      auth.uid() = id
    );
  END IF;
END
$$;

-- 9. Sprawdź, czy użytkownik admin został poprawnie dodany
SELECT * FROM public.profiles WHERE is_admin = TRUE; 