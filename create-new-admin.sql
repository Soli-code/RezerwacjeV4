-- Skrypt tworzący nowego administratora w Supabase
-- Ten skrypt tworzy nowe konto administratora i przyznaje mu pełne uprawnienia

-- 1. Utwórz nowego użytkownika (to trzeba zrobić w interfejsie Supabase, w sekcji Authentication > Users > Add User)
-- Adres email: nowy-admin@solrent.pl
-- Hasło: wybierz silne hasło

-- 2. Dodaj nowego administratora do tabeli profiles
-- Najpierw sprawdź, czy użytkownik został dodany do auth.users
SELECT id, email FROM auth.users WHERE email = 'nowy-admin@solrent.pl';

-- 3. Dodaj rekord do tabeli profiles
INSERT INTO public.profiles (id, is_admin, email)
SELECT id, TRUE, email
FROM auth.users
WHERE email = 'nowy-admin@solrent.pl'
AND NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.users.id
);

-- 4. Ustaw politykę bezwarunkową, aby nowy admin miał dostęp do wszystkiego
CREATE POLICY "Tymczasowa polityka dla testów" 
ON public.profiles 
FOR ALL USING (true);

-- 5. Ustaw podobną politykę dla tabeli admin_actions
CREATE POLICY "Tymczasowa polityka dla testów admin_actions" 
ON public.admin_actions 
FOR ALL USING (true);

-- 6. Nadaj pełne uprawnienia dla roli authenticated
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;

-- 7. Sprawdź, czy nowy administrator został poprawnie dodany
SELECT p.id, p.is_admin, p.email, u.email as auth_email
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.email = 'nowy-admin@solrent.pl'; 