# Instrukcja konfiguracji Edge Function w Supabase

## 1. Instalacja CLI Supabase

Zanim rozpoczniesz, zainstaluj Supabase CLI, aby móc wdrażać funkcje Edge Functions:

```bash
# Dla NPM
npm install -g supabase

# Dla Yarn
yarn global add supabase
```

## 2. Logowanie do Supabase

```bash
supabase login
```

Po uruchomieniu tego polecenia, zostaniesz poproszony o wprowadzenie tokenu API. Możesz go uzyskać na stronie [https://app.supabase.io/account/tokens](https://app.supabase.io/account/tokens).

## 3. Inicjalizacja projektu Supabase (jeśli jeszcze nie zrobione)

Jeśli nie masz jeszcze struktury Supabase w swoim projekcie:

```bash
supabase init
```

## 4. Utworzenie funkcji Edge Function

Struktura katalogów dla funkcji Edge Function powinna wyglądać następująco:

```
/supabase
  /functions
    /send-email
      index.ts
```

## 5. Wdrażanie funkcji Edge Function

Po przygotowaniu pliku `index.ts` w katalogu `/supabase/functions/send-email/`, uruchom następujące polecenie, aby wdrożyć funkcję:

```bash
# W PowerShell używaj średnika zamiast &&
supabase functions deploy send-email --project-ref klumxeclllfauamqnrckf
```

Gdzie `klumxeclllfauamqnrckf` to referencja do Twojego projektu Supabase.

## 6. Testowanie funkcji

Po wdrożeniu funkcji, możesz ją przetestować za pomocą skryptu `test-email-function.js`. Uruchom:

```bash
node test-email-function.js
```

## 7. Aktualizacja konfiguracji Supabase Authentication

Po poprawnym wdrożeniu funkcji, należy włączyć wykorzystanie własnego SMTP w Authentication:

1. Przejdź do Supabase Dashboard > Authentication > Email Templates
2. Upewnij się, że wszystkie szablony są poprawnie skonfigurowane
3. Przejdź do Project Settings > Auth > SMTP Settings
4. Upewnij się, że pole "Enable Custom SMTP" jest zaznaczone
5. Zapisz zmiany

## 8. Integracja z Netlify (jeśli używasz)

Jeśli używasz Netlify do hostowania swojej aplikacji, dodaj następujące zmienne środowiskowe:

1. Przejdź do Netlify Dashboard > Twój projekt > Site settings > Environment variables
2. Dodaj następujące zmienne:
   - `SUPABASE_URL`: URL Twojego projektu Supabase
   - `SUPABASE_ANON_KEY`: Anonimowy klucz Supabase
   - `SMTP_HOST`: h22.seohost.pl
   - `SMTP_PORT`: 465
   - `SMTP_USER`: biuro@solrent.pl
   - `SMTP_PASS`: arELtGPxndj9KvpsjDtZ (zalecamy użycie Netlify Environment Variable UI, aby ukryć hasło)

## 9. Dodatkowe kroki dla DNS (jeśli potrzebne)

Jeśli planujesz używać niestandardowej domeny do wysyłania maili, skonfiguruj następujące rekordy DNS:

1. Rekord SPF: Dodaj rekord TXT dla Twojej domeny: `v=spf1 include:_spf.h22.seohost.pl ~all`
2. Rekord DKIM: Powinien być skonfigurowany przez Twojego dostawcę hostingu
3. Rekord DMARC: Dodaj rekord TXT dla `_dmarc.solrent.pl` z wartością `v=DMARC1; p=none; rua=mailto:biuro@solrent.pl`

### Nie musisz konfigurować żadnych dodatkowych ustawień DNS na Netlify, ponieważ używasz SMTP z seohost.pl, który już obsługuje wysyłanie maili z domeny solrent.pl.

## 10. Rozwiązywanie problemów

Jeśli napotkasz problemy:

1. Sprawdź logi funkcji: `supabase functions logs send-email --project-ref klumxeclllfauamqnrckf`
2. Upewnij się, że dane SMTP są poprawne
3. Sprawdź, czy port 465 nie jest blokowany przez firewalle
4. Sprawdź, czy dostawca hostingu (seohost.pl) nie ma limitu na wysyłanie maili 