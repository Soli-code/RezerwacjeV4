import { supabase } from './supabase';
import { sendTemplateEmail, emailTemplates } from './email-utils';
import { retryWithBackoff } from './utils';

interface EmailData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  equipment: string;
  days: string;
  totalPrice: string;
  deposit: string;
  comment?: string;
}

export const sendEmails = async (data: EmailData): Promise<void> => {
  return retryWithBackoff(async () => {
    // Walidacja danych przed wysyłką
    if (!data.email || !data.firstName || !data.lastName) {
      throw new Error('Brak wymaganych danych do wysyłki maila');
    }

    // Walidacja długości i formatu danych
    if (data.phone && data.phone.replace(/\s/g, '').length !== 9) {
      throw new Error('Nieprawidłowy format numeru telefonu');
    }

    if (data.comment && data.comment.length > 500) {
      throw new Error('Komentarz nie może przekraczać 500 znaków');
    }

    try {
      // Przygotuj dane dla szablonu
      const templateData = {
        first_name: data.firstName,
        last_name: data.lastName,
        start_date: data.startDate,
        start_time: data.startTime || '08:00',
        end_date: data.endDate,
        end_time: data.endTime || '16:00',
        days: data.days,
        equipment: data.equipment,
        total_price: data.totalPrice,
        deposit: data.deposit
      };

      // Wyślij email do klienta
      await sendTemplateEmail({
        recipientEmail: data.email,
        subject: emailTemplates.newReservation.subject,
        htmlContent: emailTemplates.newReservation.htmlContent,
        templateData
      });

      // Wyślij email do administratora
      await sendTemplateEmail({
        recipientEmail: 'biuro@solrent.pl',
        subject: `Nowa rezerwacja: ${data.firstName} ${data.lastName}`,
        htmlContent: emailTemplates.newReservation.htmlContent,
        templateData
      });

      console.log('Emaile z rezerwacją wysłane pomyślnie');

      // Zapisz informację o wysłanych mailach
      await supabase.from('email_notifications').insert([
        {
          recipient: data.email,
          type: 'customer',
          status: 'sent',
          priority: 'high'
        },
        {
          recipient: 'biuro@solrent.pl',
          type: 'admin',
          status: 'sent',
          priority: 'high'
        }
      ]);
    } catch (error) {
      console.error('Błąd podczas wysyłania emaili:', error);
      throw error;
    }
  }, 3, 1000); // 3 próby, zaczynając od 1 sekundy
};