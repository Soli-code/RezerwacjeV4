import { supabase } from './supabase';
import { sendTemplateEmail, emailTemplates } from './email-utils';

export interface ReservationStatus {
  id: string;
  status: 'pending' | 'confirmed' | 'picked_up' | 'completed' | 'archived' | 'cancelled';
  customer_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
}

interface ReservationItem {
  equipment: {
    name: string;
    description: string;
  };
  quantity: number;
  price_per_day: number;
  deposit: number;
}

export const updateReservationStatus = async (
  reservationId: string,
  newStatus: ReservationStatus['status'],
  comment?: string
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Użytkownik nie jest zalogowany');

  // Sprawdź czy użytkownik jest adminem
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    throw new Error('Brak uprawnień do zmiany statusu rezerwacji');
  }

  // Wywołaj funkcję RPC do aktualizacji statusu
  const { error } = await supabase
    .rpc('update_reservation_status', {
      p_reservation_id: reservationId,
      p_new_status: newStatus,
      p_comment: comment
    });

  if (error) {
    throw new Error('Błąd podczas aktualizacji statusu rezerwacji');
  }

  // Pobierz dane rezerwacji i klienta do wysłania emaila
  try {
    const { data: reservation } = await supabase
      .from('reservations')
      .select(`
        *,
        customer:customers (
          first_name,
          last_name,
          email,
          phone
        ),
        items:reservation_items (
          equipment_id,
          quantity,
          price_per_day,
          deposit,
          equipment:equipment (
            name,
            description
          )
        )
      `)
      .eq('id', reservationId)
      .single();

    if (!reservation) {
      console.error('Nie znaleziono rezerwacji do wysłania emaila');
      return;
    }

    // Przygotuj dane dla szablonu
    const equipmentText = reservation.items
      .map((item: ReservationItem) => `${item.equipment.name} (${item.quantity} szt.) - ${item.price_per_day} zł/dzień`)
      .join('\n');

    // Mapowanie statusów na przyjazne dla użytkownika nazwy
    const statusMap = {
      'pending': 'Oczekująca',
      'confirmed': 'Potwierdzona',
      'picked_up': 'Odebrana',
      'in_progress': 'W trakcie',
      'completed': 'Zakończona',
      'cancelled': 'Anulowana',
      'archived': 'Zarchiwizowana'
    };

    const templateData = {
      first_name: reservation.customer.first_name,
      last_name: reservation.customer.last_name,
      status: statusMap[newStatus] || newStatus,
      start_date: new Date(reservation.start_date).toLocaleDateString('pl-PL'),
      start_time: reservation.start_time || '08:00',
      end_date: new Date(reservation.end_date).toLocaleDateString('pl-PL'),
      end_time: reservation.end_time || '16:00',
      days: reservation.days?.toString() || '1',
      equipment: equipmentText,
      total_price: reservation.total_price?.toString() || '0',
      deposit: reservation.deposit?.toString() || '0'
    };

    // Wybierz odpowiedni szablon w zależności od statusu
    let emailTemplate;
    if (newStatus === 'cancelled') {
      emailTemplate = emailTemplates.cancelReservation;
    } else if (newStatus === 'confirmed') {
      emailTemplate = emailTemplates.statusUpdate;
    } else if (newStatus === 'picked_up') {
      emailTemplate = emailTemplates.statusUpdate;
    } else if (newStatus === 'completed') {
      emailTemplate = emailTemplates.thankYou;
    } else {
      emailTemplate = emailTemplates.statusUpdate;
    }

    // Wyślij email
    await sendTemplateEmail({
      recipientEmail: reservation.customer.email,
      subject: emailTemplate.subject,
      htmlContent: emailTemplate.htmlContent,
      templateData
    });

    // Zapisz log wysłania emaila
    await supabase.from('email_notifications').insert([
      {
        reservation_id: reservationId,
        recipient: reservation.customer.email,
        type: 'status_update',
        status: 'sent'
      }
    ]);

    console.log(`Email z aktualizacją statusu (${newStatus}) wysłany pomyślnie`);
  } catch (error) {
    console.error('Błąd podczas wysyłania emaila z aktualizacją statusu:', error);
    // Nie rzucamy błędu, aby nie przerywać procesu aktualizacji statusu
  }
};

// Funkcja pomocnicza do generowania domyślnych komentarzy
const getDefaultStatusComment = (status: ReservationStatus['status']): string => {
  switch (status) {
    case 'confirmed':
      return 'Rezerwacja potwierdzona';
    case 'picked_up':
      return 'Sprzęt odebrany';
    case 'completed':
      return 'Rezerwacja zakończona';
    case 'archived':
      return 'Rezerwacja przeniesiona do historycznych';
    case 'cancelled':
      return 'Rezerwacja anulowana';
    default:
      return 'Status zmieniony';
  }
};

export const getReservationHistory = async (reservationId: string) => {
  const { data, error } = await supabase
    .from('reservation_history')
    .select(`
      id,
      previous_status,
      new_status,
      changed_at,
      comment,
      changed_by
    `)
    .eq('reservation_id', reservationId)
    .order('changed_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const getReservationDetails = async (reservationId: string) => {
  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      customer:customers (
        first_name,
        last_name,
        email,
        phone
      ),
      items:reservation_items (
        equipment_id,
        quantity,
        price_per_day,
        deposit,
        equipment:equipment (
          name,
          description
        )
      )
    `)
    .eq('id', reservationId)
    .single();

  if (error) throw error;
  return data;
};

export const subscribeToReservationUpdates = (
  onUpdate: (reservation: ReservationStatus) => void
) => {
  const channel = supabase
    .channel('reservation_updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'reservations'
      },
      (payload) => {
        onUpdate(payload.new as ReservationStatus);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};