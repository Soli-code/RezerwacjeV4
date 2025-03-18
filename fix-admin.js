// Skrypt do naprawy administratora w tabeli profiles
// Uruchomienie: node fix-admin.js

import { createClient } from '@supabase/supabase-js';

// Konfiguracja klienta Supabase
const supabaseUrl = 'https://klumxecllfauamqnrckf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdW14ZWNsbGZhdWFtcW5yY2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDcyNzUsImV4cCI6MjA1NzIyMzI3NX0.S20v_K_5pDY0oA-4ztB1mlRWRF4vyt-NETZkvyx0PjE';

// Funkcja do naprawy administratora
async function fixAdmin() {
  console.log('Naprawa konta administratora...');

  // Inicjalizacja klienta Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Adres email administratora
    const adminEmail = 'biuro@solrent.pl';
    
    // Krok 1: Sprawdź, czy tabela profiles istnieje
    console.log('\n1. Sprawdzanie tabeli profiles...');
    const { error: tableError } = await supabase.from('profiles').select('count').single();
    
    if (tableError && tableError.code === '42P01') {
      console.error('❌ Tabela "profiles" nie istnieje. Najpierw uruchom migrację w panelu Supabase.');
      return;
    }
    
    // Krok 2: Pobierz ID użytkownika z tabeli auth.users
    console.log('\n2. Pobieranie informacji o użytkowniku...');
    
    // Najpierw spróbujmy zalogować się
    console.log('Próba logowania jako administrator...');
    const loginResult = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: 'admin123' // Domyślne hasło - użytkownik powinien je zmienić
    });
    
    let userId;
    
    if (loginResult.error) {
      console.log('⚠️ Nie udało się zalogować:', loginResult.error.message);
      
      // Sprawdźmy czy użytkownik istnieje w auth.users (wymaga uprawnień serwisowych)
      console.log('Sprawdzanie czy użytkownik istnieje...');
      
      try {
        // Próba stworzenia nowego użytkownika (może się nie powieść bez uprawnień serwisowych)
        console.log('Próba utworzenia użytkownika (może wymagać klucza serwisowego)...');
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: adminEmail,
          password: 'admin123',
          options: {
            data: {
              is_admin: true
            }
          }
        });
        
        if (signupError) {
          console.error('❌ Nie udało się utworzyć użytkownika:', signupError.message);
        } else {
          console.log('✅ Utworzono nowego użytkownika');
          userId = signupData.user.id;
        }
      } catch (authError) {
        console.error('❌ Błąd podczas operacji uwierzytelniania:', authError.message);
      }
    } else {
      console.log('✅ Zalogowano pomyślnie');
      userId = loginResult.data.user.id;
    }
    
    if (!userId) {
      console.error('❌ Nie udało się uzyskać ID użytkownika');
      console.log('⚠️ Musisz samodzielnie utworzyć użytkownika w panelu Supabase:');
      console.log('   1. Otwórz https://supabase.com/dashboard/project/klumxecllfauamqnrckf');
      console.log('   2. Przejdź do Authentication -> Users');
      console.log('   3. Kliknij "Add User" i utwórz użytkownika biuro@solrent.pl');
      return;
    }
    
    // Krok 3: Dodaj lub zaktualizuj wpis administratora w tabeli profiles
    console.log(`\n3. Dodawanie/aktualizacja wpisu administratora (ID: ${userId})...`);
    
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Błąd podczas sprawdzania profilu:', profileError.message);
    }
    
    if (existingProfile) {
      console.log('Profil administratora już istnieje, aktualizuję uprawnienia...');
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_admin: true })
        .eq('id', userId);
      
      if (updateError) {
        console.error('❌ Błąd podczas aktualizacji profilu:', updateError.message);
      } else {
        console.log('✅ Zaktualizowano uprawnienia administratora');
      }
    } else {
      console.log('Tworzę nowy profil administratora...');
      
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([
          {
            id: userId,
            email: adminEmail,
            is_admin: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]);
      
      if (insertError) {
        console.error('❌ Błąd podczas tworzenia profilu:', insertError.message);
      } else {
        console.log('✅ Utworzono profil administratora');
      }
    }
    
    // Podsumowanie
    console.log('\n=== PODSUMOWANIE ===');
    console.log('✅ Jeśli nie wystąpiły żadne błędy, konto administratora zostało naprawione');
    console.log('   Login: biuro@solrent.pl');
    
    if (loginResult.error) {
      console.log('   Hasło: admin123 (jeśli użytkownik został utworzony w tym procesie)');
      console.log('   ⚠️ Zalecamy zmianę hasła po pierwszym logowaniu!');
    }
    
  } catch (error) {
    console.error('❌ Nieoczekiwany błąd podczas naprawy:', error.message);
  }
}

// Uruchomienie funkcji naprawiającej
fixAdmin(); 