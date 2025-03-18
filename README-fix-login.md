# Instrukcja naprawy logowania administratora

## Krok 1: Wykonaj skrypt SQL w panelu Supabase

1. Zaloguj się do panelu administracyjnego Supabase
2. Przejdź do sekcji "SQL Editor"
3. Wklej zawartość pliku `fix-login-final.sql` i wykonaj zapytanie
4. Po wykonaniu skryptu, w wynikach powinny być widoczne zaktualizowane profile administratorów

## Krok 2: Zbuduj i uruchom aplikację ponownie

```powershell
npm run build; npm run preview
```

lub

```powershell
npm run dev
```

## Krok 3: Zweryfikuj logowanie administratora

1. Otwórz aplikację w przeglądarce
2. Zaloguj się używając adresu email `biuro@solrent.pl` oraz hasła
3. Jeśli logowanie powiedzie się, zostaniesz przekierowany do panelu administratora

## Rozwiązane problemy

Wykonany skrypt naprawia następujące problemy:

1. **Niezgodność struktur tablic** - Dodaje brakujące kolumny w tabeli `profiles`
2. **Brak powiązania profili z adresami email** - Aktualizuje kolumnę email dla administratorów
3. **Problem z uprawnieniami (Row Level Security)** - Konfiguruje polityki dostępu dla administratorów
4. **Brak tabeli dla logowania administratorów** - Tworzy tabelę `admin_actions` jeśli nie istnieje
5. **Nadaje odpowiednie uprawnienia** - Przyznaje niezbędne uprawnienia użytkownikom na schemacie public

## Dalsze kroki, jeśli problem nie został rozwiązany

Jeśli nadal występują problemy z logowaniem:

1. Sprawdź logi aplikacji w konsoli przeglądarki
2. Wykonaj zapytanie sprawdzające profile administratorów:
   ```sql
   SELECT p.id, p.is_admin, p.email, u.email as auth_email
   FROM public.profiles p
   LEFT JOIN auth.users u ON p.id = u.id
   WHERE p.is_admin = TRUE;
   ```
3. Sprawdź, czy zapytanie z powyższego punktu zwraca rekordy i czy kolumna `email` jest poprawnie wypełniona
4. Zbuduj aplikację na nowo: `npm run build; npm run preview` 