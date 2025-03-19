// Skrypt do testowania funkcji Edge Function do wysyłania maili
// Uruchom ten skrypt po wdrożeniu funkcji Edge Function

async function testEmailFunction() {
  // UWAGA: Zamień URL na faktyczny adres Twojej funkcji Edge Function po wdrożeniu
  const functionUrl = "https://klumxeclllfauamqnrckf.supabase.co/functions/v1/send-email";
  
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Jeśli funkcja wymaga autoryzacji, dodaj nagłówek Authorization
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdW14ZWNsbGZhdWFtcW5yY2tmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTY0NzI3NSwiZXhwIjoyMDU3MjIzMjc1fQ.24k0Ssu_Gve-lqgN4HOlcqhvKYY_njvs3oz6Xkl5N_o'
      },
      body: JSON.stringify({
        to: 'biuro@solrent.pl', // Testowy adres email (najlepiej własny)
        subject: 'Test funkcji wysyłania maili',
        html: '<h1>Test wysyłania maili</h1><p>To jest testowa wiadomość z funkcji Edge Function.</p>'
      })
    });

    const data = await response.json();
    console.log('Odpowiedź z funkcji:', data);
    
    if (response.ok) {
      console.log('✅ Test zakończony sukcesem - email został wysłany!');
    } else {
      console.error('❌ Test nie powiódł się:', data.error);
    }
  } catch (error) {
    console.error('❌ Wystąpił błąd podczas testowania funkcji:', error);
  }
}

// Wywołaj funkcję testową
testEmailFunction(); 