// Prosty skrypt do sprawdzenia połączenia z Supabase
// Uruchomienie: node check-connection.js

import { createClient } from '@supabase/supabase-js';

// Konfiguracja klienta Supabase z danymi z pliku .env
const supabaseUrl = 'https://klumxecllfauamqnrckf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdW14ZWNsbGZhdWFtcW5yY2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDcyNzUsImV4cCI6MjA1NzIyMzI3NX0.S20v_K_5pDY0oA-4ztB1mlRWRF4vyt-NETZkvyx0PjE';

// Funkcja do sprawdzania połączenia
async function checkConnection() {
  console.log('Sprawdzanie połączenia z Supabase...');

  // Inicjalizacja klienta Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('URL Supabase:', supabaseUrl);
    
    // Test 1: Sprawdzenie wersji API
    console.log('\nTest 1: Sprawdzanie wersji API...');
    const { data: versionData, error: versionError } = await supabase.rpc('get_supabase_version');
    
    if (versionError) {
      console.error('❌ Błąd pobierania wersji:', versionError.message);
    } else {
      console.log('✅ Wersja Supabase:', versionData || 'Nieznana');
    }

    // Test 2: Prosty test uwierzytelniania
    console.log('\nTest 2: Sprawdzanie uwierzytelniania...');
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('❌ Błąd uwierzytelniania:', authError.message);
    } else {
      console.log('✅ API uwierzytelniania działa poprawnie');
      console.log('   Sesja:', authData.session ? 'Aktywna' : 'Brak aktywnej sesji');
    }

    // Test 3: Próba pobrania danych z tabeli (może nie istnieć)
    console.log('\nTest 3: Próba dostępu do bazy danych...');
    const { data: dbData, error: dbError } = await supabase.from('profiles').select('count').single();
    
    if (dbError) {
      if (dbError.code === '42P01') {
        console.log('⚠️ Tabela "profiles" nie istnieje, ale połączenie do bazy działa');
      } else {
        console.error('❌ Błąd dostępu do bazy danych:', dbError.message);
      }
    } else {
      console.log('✅ Udało się połączyć z bazą danych');
      console.log('   Tabela "profiles" istnieje, liczba rekordów:', dbData.count);
    }

    // Podsumowanie
    console.log('\n=== PODSUMOWANIE DIAGNOSTYKI ===');
    
    if (versionError || authError || (dbError && dbError.code !== '42P01')) {
      console.log('❌ Wykryto problemy z połączeniem do Supabase');
      console.log('   Sprawdź swoje klucze API i połączenie internetowe');
    } else {
      console.log('✅ Połączenie z Supabase działa poprawnie');
      
      if (dbError && dbError.code === '42P01') {
        console.log('⚠️ Tabela "profiles" nie istnieje - może być potrzebne wykonanie migracji');
        console.log('   Wykonaj skrypt SQL z pliku migrations/init_auth_tables.sql w panelu Supabase');
      }
    }

  } catch (error) {
    console.error('❌ Nieoczekiwany błąd podczas testowania połączenia:', error.message);
  }
}

// Uruchomienie funkcji sprawdzającej
checkConnection(); 