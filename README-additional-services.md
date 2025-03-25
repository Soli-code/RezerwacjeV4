# Instrukcja tworzenia tabeli dla usług dodatkowych

W aplikacji występuje błąd związany z brakiem tabeli `reservation_additional_services` w bazie danych Supabase. Ta instrukcja pomoże ci utworzyć tę tabelę.

## Problem

Błąd, który może się pojawić:
```
Error loading additional services: relation "public.reservation_additional_services" does not exist
```

Oznacza to, że w bazie danych brakuje tabeli przechowującej informacje o usługach dodatkowych przypisanych do rezerwacji.

## Rozwiązanie

1. Zaloguj się do **panelu administracyjnego Supabase** dla twojego projektu.
2. Przejdź do sekcji **SQL Editor** (Edytor SQL).
3. Stwórz nową kwerendę (New Query) i wklej zawartość pliku `create-additional-services-table.sql`.
4. Uruchom kwerendę (Run).

## Zawartość pliku SQL

Poniżej znajduje się zawartość pliku `create-additional-services-table.sql`, który tworzy tabelę:

```sql
-- Skrypt tworzący tylko tabelę reservation_additional_services, jeśli nie istnieje

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reservation_additional_services') THEN
        -- Tworzymy tabelę
        CREATE TABLE public.reservation_additional_services (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
            service_id TEXT NOT NULL, -- ID usługi (może być string, np. 'gas', 'vacuum', etc.)
            quantity INTEGER NOT NULL DEFAULT 1,
            price NUMERIC(10, 2),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Komentarze do tabeli
        COMMENT ON TABLE public.reservation_additional_services IS 'Tabela przechowująca dodatkowe usługi przypisane do rezerwacji';
        COMMENT ON COLUMN public.reservation_additional_services.id IS 'Unikalny identyfikator usługi dodatkowej';
        COMMENT ON COLUMN public.reservation_additional_services.reservation_id IS 'Identyfikator rezerwacji, do której przypisana jest usługa';
        COMMENT ON COLUMN public.reservation_additional_services.service_id IS 'Identyfikator usługi (np. "gas" dla butli gazowej)';
        COMMENT ON COLUMN public.reservation_additional_services.quantity IS 'Ilość usług';
        COMMENT ON COLUMN public.reservation_additional_services.price IS 'Cena jednostkowa usługi';

        -- RLS (Row Level Security) - zabezpieczenia na poziomie wierszy
        ALTER TABLE public.reservation_additional_services ENABLE ROW LEVEL SECURITY;

        -- Polityka RLS dla wszystkich uwierzytelnionych użytkowników (zamiast tylko administratorów)
        CREATE POLICY "Authenticated users can do anything" ON public.reservation_additional_services 
        FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
        
        -- Polityka dla użytkowników - dostęp tylko do własnych rezerwacji
        CREATE POLICY "Users can view their own reservation services" ON public.reservation_additional_services 
        FOR SELECT USING (reservation_id IN (SELECT id FROM public.reservations WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())));

        -- Indeksy
        CREATE INDEX idx_reservation_additional_services_reservation_id ON public.reservation_additional_services(reservation_id);
        CREATE INDEX idx_reservation_additional_services_service_id ON public.reservation_additional_services(service_id);

        RAISE NOTICE 'Tabela reservation_additional_services została utworzona.';
    ELSE
        RAISE NOTICE 'Tabela reservation_additional_services już istnieje.';
    END IF;
END $$;
```

## Po wykonaniu skryptu

Po pomyślnym utworzeniu tabeli, funkcjonalność usług dodatkowych powinna działać prawidłowo. Możesz dodawać i zapisywać usługi dodatkowe w systemie rezerwacji.

## Jak działają usługi dodatkowe

1. **Czym są usługi dodatkowe:**
   - To dodatkowe produkty/usługi jak butla gazowa, odkurzacz, proszek piorący, rusztowanie, wiertła itp.
   - Można je dodać do rezerwacji niezależnie od głównego sprzętu

2. **Gdzie je zobaczyć:**
   - Po zapisaniu, usługi dodatkowe będą widoczne w osobnej sekcji "Usługi dodatkowe" na stronie rezerwacji
   - Sekcja ta jest oddzielna od "Zarezerwowany sprzęt", który pokazuje główny sprzęt rezerwacji

3. **Jak dodać usługi dodatkowe:**
   - W widoku rezerwacji znajdź sekcję "Usługi dodatkowe"
   - Ustaw ilość za pomocą przycisków + i -
   - Kliknij "Zapisz zmiany", aby zapisać wybrane usługi 