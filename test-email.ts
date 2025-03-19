import { supabase } from './src/lib/supabase';
import { emailTemplates } from './src/lib/email-utils';

async function testEmail() {
  try {
    console.log('Rozpoczynam wysyłanie testowego emaila...');
    
    // Przetwarzanie szablonu
    const templateData = {
      first_name: 'Test',
      last_name: 'Testowy',
      start_date: '2025-01-01',
      start_time: '10:00',
      end_date: '2025-01-05',
      end_time: '16:00',
      days: '5',
      equipment: 'Wiertarka (1 szt.) - 50 zł/dzień\nSzlifierka (1 szt.) - 60 zł/dzień',
      total_price: '550',
      deposit: '200',
      status: 'Potwierdzona'
    };
    
    // Zastąp zmienne w szablonie
    let processedHtml = emailTemplates.newReservation.htmlContent;
    Object.entries(templateData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedHtml = processedHtml.replace(regex, value?.toString() || '');
    });
    
    // Bezpośrednie wywołanie funkcji Edge Function
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to: 'twoj.email@example.com', // Zmień na swój adres email
        subject: 'Email testowy z SOLRENT',
        html: processedHtml
      }
    });
    
    if (error) {
      throw new Error(`Błąd podczas wysyłania emaila: ${error.message}`);
    }
    
    console.log('Email został wysłany!', data);
  } catch (error) {
    console.error('Błąd podczas wysyłania emaila:', error);
  } finally {
    // Zamknij połączenie z Supabase
    await supabase.auth.signOut();
  }
}

testEmail(); 