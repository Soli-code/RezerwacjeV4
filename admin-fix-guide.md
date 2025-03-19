# Rozwiązanie problemu z logowaniem administratora biuro@solrent.pl

## Analiza problemu

Problem polega na tym, że konto kubensit@gmail.com działa poprawnie jako administrator, ale konto biuro@solrent.pl ma problemy z logowaniem. Oto potencjalne przyczyny:

1. Brak rekordu lub nieprawidłowy rekord w tabeli `profiles` dla biuro@solrent.pl
2. Nieprawidłowa wartość flagi `is_admin` dla tego konta
3. Problemy z uprawnieniami Row Level Security
4. Niezgodność między ID użytkownika w tabelach `auth.users` i `profiles`

## Rozwiązanie

### Krok 1: Wykonaj skrypt SQL w Supabase SQL Editor

Uruchom poniższy skrypt w edytorze SQL Supabase, aby naprawić problem:

```sql
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
```

### Krok 2: Dodaj politykę bezwarunkową (jeśli problem nadal występuje)

Jeśli po wykonaniu powyższego skryptu problem nadal występuje, można dodać politykę bezwarunkową:

```sql
-- Dodaj tymczasową politykę bezwarunkową, aby zdiagnozować problem
CREATE POLICY "Tymczasowa polityka dla testów" 
ON public.profiles 
FOR ALL USING (true);
```

### Krok 3: Zresetuj hasło konta biuro@solrent.pl

Jeśli po naprawie uprawnień nadal występują problemy z logowaniem, warto zresetować hasło konta:

1. W panelu Supabase przejdź do Authentication > Users
2. Znajdź użytkownika biuro@solrent.pl
3. Użyj opcji "Reset Password" lub "Send Password Recovery Email"

### Krok 4: Sprawdź ustawienia aplikacji

Upewnij się, że w aplikacji:

1. Dane logowania są poprawnie przesyłane
2. Nie ma modyfikacji haseł ani adresów email

## Co zrobić jeśli skrypt nie pomógł?

Jeśli po wykonaniu powyższych kroków nadal nie można zalogować się na konto biuro@solrent.pl, należy:

1. Usunąć rekord z tabeli `profiles` związany z tym kontem
2. Utworzyć go od nowa
3. Dodać bezpośrednio przez API Supabase:

```javascript
const { data, error } = await supabase
  .from('profiles')
  .upsert({ 
    id: 'ID_UZYTKOWNIKA', // ID z tabeli auth.users
    is_admin: true,
    email: 'biuro@solrent.pl'
  });
```

## Dlaczego konto kubensit@gmail.com działa?

Konto kubensit@gmail.com prawdopodobnie ma:

1. Poprawnie ustawione ID w tabeli `profiles`
2. Prawidłowo ustawioną flagę `is_admin = true`
3. Pasującą wartość `email` w tabeli `profiles` i `auth.users`
4. Profil utworzony wcześniej, z innymi uprawnieniami RLS 