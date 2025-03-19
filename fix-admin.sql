-- Skrypt SQL do naprawy konta administratora
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

-- Utwórz politykę, która pozwala administratorom na pełny dostęp
CREATE POLICY IF NOT EXISTS "Administratorzy mają pełny dostęp do profili" 
  ON public.profiles 
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = TRUE)
  );

-- 5. Dodaj użytkownika admina do tabeli profiles (opcja 1 - jeśli znasz UUID)
-- Zastąp 'WSTAW_TUTAJ_UUID_UŻYTKOWNIKA' rzeczywistym UUID użytkownika
-- INSERT INTO public.profiles (id, email, is_admin)
-- VALUES ('WSTAW_TUTAJ_UUID_UŻYTKOWNIKA', 'biuro@solrent.pl', TRUE)
-- ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;

-- 5. Dodaj użytkownika admina do tabeli profiles (opcja 2 - dynamicznie)
-- To zadziała tylko jeśli użytkownik biuro@solrent.pl już istnieje w auth.users
INSERT INTO public.profiles (id, email, is_admin)
SELECT id, email, TRUE
FROM auth.users
WHERE email = 'biuro@solrent.pl'
ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;

-- 6. Sprawdź, czy użytkownik admin został poprawnie dodany
SELECT * FROM public.profiles WHERE is_admin = TRUE;

-- 7. Jeśli użytkownik admin nie istnieje, musisz najpierw utworzyć go w sekcji Authentication -> Users 