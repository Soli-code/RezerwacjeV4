# SolRent - System rezerwacji

## Rozwiązywanie problemów z logowaniem do panelu administratora

### Szybka naprawa

Jeśli masz problemy z logowaniem do panelu administratora, uruchom następujące polecenie:

```bash
npm run db:fix
```

To narzędzie automatycznie:
1. Sprawdzi połączenie z Supabase
2. Utworzy brakujące tabele jeśli nie istnieją
3. Sprawdzi konto administratora i naprawi je w razie potrzeby
4. Odblokuje konto administratora jeśli zostało zablokowane

### Inne narzędzia diagnostyczne

Dostępne są również inne narzędzia do diagnostyki i naprawy:

- `npm run db:check` - sprawdza stan bazy danych i konta administratora
- `npm run db:migrate` - wykonuje migrację bazy danych (tworzy tabele)

### Ręczna naprawa

Jeśli automatyczne narzędzia nie działają, można wykonać naprawę ręcznie:

1. Zaloguj się do [Panelu Supabase](https://app.supabase.com)
2. Wybierz swój projekt
3. Przejdź do zakładki "SQL Editor"
4. Wykonaj poniższe zapytanie:

```sql
-- 1. Tworzenie tabeli profili jeśli nie istnieje
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tworzenie tabeli dla akcji administratora
CREATE TABLE IF NOT EXISTS public.admin_actions (
    id SERIAL PRIMARY KEY,
    admin_id UUID REFERENCES public.profiles(id),
    action TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Tworzenie indeksu
CREATE INDEX IF NOT EXISTS admin_actions_admin_id_idx ON public.admin_actions (admin_id);

-- 4. Upewnienie się, że użytkownik ma profil z uprawnieniami administratora
INSERT INTO public.profiles (id, email, is_admin)
SELECT id, email, TRUE
FROM auth.users
WHERE email = 'biuro@solrent.pl'
ON CONFLICT (id) DO UPDATE SET is_admin = TRUE;
```

## Uruchamianie projektu

```bash
# Instalacja zależności
npm install

# Uruchomienie w trybie deweloperskim
npm run dev

# Budowanie do produkcji
npm run build
```

## Struktura projektu

- `src/` - kod źródłowy aplikacji
  - `components/` - komponenty React
  - `lib/` - biblioteki i narzędzia 
  - `hooks/` - hooki React
  - `types/` - definicje typów TypeScript
- `public/` - zasoby statyczne
- `migrations/` - skrypty migracji bazy danych
