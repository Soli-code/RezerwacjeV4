-- Skrypt naprawczy dla problemów z uprawnieniami i logowaniem
-- Uruchom ten skrypt w Supabase SQL Editor z uprawnieniami administratora

-- 1. Sprawdź strukturę tabeli profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles';

-- 2. Sprawdź, czy kolumna email jest pusta dla administratorów
SELECT p.id, p.is_admin, p.email, u.email as auth_email
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.is_admin = TRUE;

-- 3. Dodaj brakujące kolumny jeśli nie istnieją
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 4. Zaktualizuj kolumnę email w profilach administratorów 
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.is_admin = TRUE
AND (p.email IS NULL OR p.email = '');

-- 5. Włącz Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Usuń istniejące polityki dla tabeli profiles
-- (Najpierw pobierz nazwy istniejących polityk)
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_record.policyname);
    END LOOP;
END
$$;

-- 7. Utwórz nowe polityki dostępu
-- Dla administratorów - pełny dostęp
CREATE POLICY "Administratorzy maja pelny dostep do profili" 
ON public.profiles 
FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = TRUE)
);

-- Dla zwykłych użytkowników - tylko odczyt własnego profilu
CREATE POLICY "Uzytkownicy moga odczytywac swoje profile" 
ON public.profiles 
FOR SELECT USING (
  auth.uid() = id
);

-- 8. Utwórz tabelę admin_actions jeśli nie istnieje
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  action_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Włącz RLS na tabeli admin_actions i dodaj politykę
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- 10. Usuń istniejące polityki dla tabeli admin_actions
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'admin_actions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.admin_actions', policy_record.policyname);
    END LOOP;
END
$$;

-- 11. Dodaj politykę dla admin_actions
CREATE POLICY "Administratorzy maja pelny dostep do akcji" 
ON public.admin_actions 
FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = TRUE)
);

-- 12. Nadaj uprawnienia dla uwierzytelnionych użytkowników
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.admin_actions TO authenticated;

-- 13. Sprawdź ostateczny stan profili administratorów
SELECT p.id, p.is_admin, p.email, u.email as auth_email
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.is_admin = TRUE; 