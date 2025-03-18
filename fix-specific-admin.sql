-- Skrypt naprawiający problem z kontem biuro@solrent.pl

-- 1. Sprawdź użytkownika w bazie auth.users
SELECT id, email, last_sign_in_at, created_at
FROM auth.users
WHERE email = 'biuro@solrent.pl';

-- 2. Sprawdź, czy użytkownik ma poprawny rekord w tabeli profiles
SELECT p.id, p.is_admin, p.email, u.email as auth_email
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.email = 'biuro@solrent.pl';

-- 3. Sprawdź porównanie obu kont administratorskich
SELECT p.id, p.is_admin, p.email, u.email as auth_email
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.email IN ('biuro@solrent.pl', 'kubensit@gmail.com');

-- 4. Napraw konto biuro@solrent.pl - upewnij się, że ma is_admin=TRUE
UPDATE public.profiles p
SET is_admin = TRUE, 
    email = u.email
FROM auth.users u
WHERE p.id = u.id
AND u.email = 'biuro@solrent.pl';

-- 5. Jeśli rekord nie istnieje w tabeli profiles, utwórz go
INSERT INTO public.profiles (id, is_admin, email)
SELECT id, TRUE, email
FROM auth.users
WHERE email = 'biuro@solrent.pl'
AND NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.users.id
);

-- 6. Nadaj dodatkowe uprawnienia dla roli authenticated
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE, INSERT ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.admin_actions TO authenticated;

-- 7. Upewnij się, że polityki RLS są prawidłowo skonfigurowane
-- Usuń i utwórz ponownie politykę dla administratorów
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Administratorzy maja pelny dostep do profili'
  ) THEN
    DROP POLICY "Administratorzy maja pelny dostep do profili" ON public.profiles;
  END IF;
END
$$;

-- Utwórz silniejszą politykę dla administratorów
CREATE POLICY "Administratorzy maja pelny dostep do profili" 
ON public.profiles 
FOR ALL USING (
  auth.uid() IN (
    SELECT id FROM public.profiles 
    WHERE is_admin = TRUE 
    OR id = auth.uid()
  )
);

-- 8. Sprawdź ostateczny stan - czy konto biuro@solrent.pl ma is_admin=TRUE
SELECT p.id, p.is_admin, p.email, u.email as auth_email
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.email = 'biuro@solrent.pl'; 