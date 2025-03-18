-- Skrypt naprawiający problemy z logowaniem administratora

-- 1. Sprawdź strukturę tabeli profiles i dodaj brakujące kolumny
DO $$
BEGIN
  -- Sprawdź czy istnieje kolumna email i dodaj ją jeśli nie istnieje
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;

  -- Sprawdź czy istnieje kolumna full_name i dodaj ją jeśli nie istnieje
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
  END IF;
END
$$;

-- 2. Zaktualizuj kolumnę email w profilu administratora na podstawie danych z auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.is_admin = TRUE
AND (p.email IS NULL OR p.email = '');

-- 3. Włącz Row Level Security na tabeli profiles (jeśli nie jest włączona)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Usuń istniejące polityki (jeśli istnieją)
DO $$
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON public.profiles;', E'\n')
    FROM pg_policies
    WHERE tablename = 'profiles'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Ignoruj błędy, które mogą wystąpić, jeśli nie ma polityk
    RAISE NOTICE 'Błąd podczas usuwania polityk: %', SQLERRM;
END
$$;

-- 5. Stwórz politykę dla administratorów
CREATE POLICY "Administratorzy maja pelny dostep do profili" 
ON public.profiles 
FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = TRUE)
);

-- 6. Stwórz politykę dla zwykłych użytkowników
CREATE POLICY "Uzytkownicy moga odczytywac swoje profile" 
ON public.profiles 
FOR SELECT USING (
  auth.uid() = id
);

-- 7. Sprawdź czy tabela admin_actions istnieje i utwórz ją jeśli nie
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  action_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Włącz RLS na tabeli admin_actions
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- 9. Dodaj politykę dla admin_actions
CREATE POLICY "Administratorzy maja pelny dostep do akcji" 
ON public.admin_actions 
FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = TRUE)
);

-- 10. Napraw uprawnienia dla profili administratorów - dodaj uprawnienia na schemacie public
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.admin_actions TO authenticated;

-- 11. Sprawdź profile administratorów
SELECT p.id, p.is_admin, p.email, u.email as auth_email
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.is_admin = TRUE; 