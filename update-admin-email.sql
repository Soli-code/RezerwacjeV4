-- Skrypt aktualizujący adresy email w tabeli profiles

-- 1. Sprawdź dane użytkowników w tabeli auth.users
SELECT id, email FROM auth.users;

-- 2. Zaktualizuj kolumnę email w tabeli profiles na podstawie danych z auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.is_admin = TRUE;

-- 3. Sprawdź, czy aktualizacja się powiodła
SELECT p.id, p.is_admin, p.email, u.email as auth_email
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.is_admin = TRUE; 