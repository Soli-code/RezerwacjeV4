// Funkcja pomocnicza do wysyłania emaili z szablonami
export async function sendTemplateEmail({
  recipientEmail,
  subject,
  htmlContent,
  templateData
}: {
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  templateData: Record<string, string | number>;
}) {
  try {
    // Używamy klucza anonimowego do autoryzacji - działa dla wszystkich użytkowników
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email-template`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          recipientEmail,
          subject,
          htmlContent,
          templateData,
        }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Błąd wysyłania emaila:', errorData);
      throw new Error(`Błąd wysyłania emaila: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Błąd wysyłania emaila:', error);
    throw error;
  }
}

// Szablony emaili
export const emailTemplates = {
  newReservation: {
    subject: 'Potwierdzenie nowej rezerwacji',
    htmlContent: `
      <h2>Dziękujemy za rezerwację!</h2>
      <p>Witaj {{first_name}},</p>
      <p>Twoja rezerwacja została przyjęta i oczekuje na potwierdzenie.</p>
      <h3>Szczegóły rezerwacji:</h3>
      <ul>
        <li>Data rozpoczęcia: {{start_date}} {{start_time}}</li>
        <li>Data zakończenia: {{end_date}} {{end_time}}</li>
        <li>Liczba dni: {{days}}</li>
        <li>Sprzęt: {{equipment}}</li>
        <li>Całkowita cena: {{total_price}} zł</li>
        <li>Kaucja: {{deposit}} zł</li>
      </ul>
      <p>Skontaktujemy się z Tobą wkrótce w celu potwierdzenia rezerwacji.</p>
    `
  },
  statusUpdate: {
    subject: 'Aktualizacja statusu rezerwacji',
    htmlContent: `
      <h2>Aktualizacja statusu rezerwacji</h2>
      <p>Witaj {{first_name}},</p>
      <p>Status Twojej rezerwacji został zaktualizowany na: <strong>{{status}}</strong></p>
      <h3>Szczegóły rezerwacji:</h3>
      <ul>
        <li>Data rozpoczęcia: {{start_date}} {{start_time}}</li>
        <li>Data zakończenia: {{end_date}} {{end_time}}</li>
        <li>Liczba dni: {{days}}</li>
        <li>Sprzęt: {{equipment}}</li>
        <li>Całkowita cena: {{total_price}} zł</li>
        <li>Kaucja: {{deposit}} zł</li>
      </ul>
    `
  },
  cancelReservation: {
    subject: 'Anulowanie rezerwacji',
    htmlContent: `
      <h2>Anulowanie rezerwacji</h2>
      <p>Witaj {{first_name}},</p>
      <p>Twoja rezerwacja została anulowana.</p>
      <h3>Szczegóły anulowanej rezerwacji:</h3>
      <ul>
        <li>Data rozpoczęcia: {{start_date}} {{start_time}}</li>
        <li>Data zakończenia: {{end_date}} {{end_time}}</li>
        <li>Liczba dni: {{days}}</li>
        <li>Sprzęt: {{equipment}}</li>
        <li>Całkowita cena: {{total_price}} zł</li>
        <li>Kaucja: {{deposit}} zł</li>
      </ul>
      <p>Jeśli masz pytania, prosimy o kontakt.</p>
    `
  },
  thankYou: {
    subject: 'Dziękujemy za skorzystanie z naszych usług',
    htmlContent: `
      <h2>Dziękujemy za skorzystanie z naszych usług!</h2>
      <p>Witaj {{first_name}},</p>
      <p>Dziękujemy za skorzystanie z naszych usług. Mamy nadzieję, że wszystko spełniło Twoje oczekiwania.</p>
      <h3>Szczegóły zakończonej rezerwacji:</h3>
      <ul>
        <li>Data rozpoczęcia: {{start_date}} {{start_time}}</li>
        <li>Data zakończenia: {{end_date}} {{end_time}}</li>
        <li>Liczba dni: {{days}}</li>
        <li>Sprzęt: {{equipment}}</li>
        <li>Całkowita cena: {{total_price}} zł</li>
        <li>Kaucja: {{deposit}} zł</li>
      </ul>
      <p>Zapraszamy ponownie!</p>
    `
  }
}; 