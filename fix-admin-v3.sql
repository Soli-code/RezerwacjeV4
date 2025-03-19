-- Skrypt do sprawdzenia i naprawy polityk dostępu dla administratorów

-- 1. Sprawdź istniejące polityki dla tabeli profiles
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 2. Włącz Row Level Security na tabeli profiles (jeśli nie jest włączona)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Usuń istniejące polityki (jeśli istnieją)
DO $$
BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS "' || policyname || '" ON public.profiles;', E'\n')
    FROM pg_policies
    WHERE tablename = 'profiles'
  );
END
$$;

-- 4. Utwórz politykę dla administratorów
CREATE POLICY "Administratorzy mają pełny dostęp do profili" 
ON public.profiles 
FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE is_admin = TRUE)
);

-- 5. Utwórz politykę dla zwykłych użytkowników
CREATE POLICY "Użytkownicy mogą odczytywać swoje profile" 
ON public.profiles 
FOR SELECT USING (
  auth.uid() = id
);

-- 6. Sprawdź czy są jacyś administratorzy
SELECT * FROM public.profiles WHERE is_admin = TRUE;

-- 7. Sprawdź nowo utworzone polityki
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles'; 