import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { Filter, Download, Edit2, X, Check, AlertTriangle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import plLocale from '@fullcalendar/core/locales/pl';

interface Reservation {
  id: string;
  customer_id: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  items: Array<{
    equipment: {
      name: string;
    };
    quantity: number;
  }>;
}

const AdminCalendar: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>(['confirmed', 'pending']);
  const [selectedEvent, setSelectedEvent] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    loadReservations();
  }, [selectedStatus]);

  const loadReservations = async () => {
    try {
      setIsLoading(true);
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
            quantity,
            equipment:equipment (
              name
            )
          )
        `)
        .in('status', selectedStatus);

      if (error) throw error;
      setReservations(data || []);
    } catch (err) {
      console.error('Error loading reservations:', err);
      setError('Nie udało się załadować rezerwacji');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (reservationId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: newStatus })
        .eq('id', reservationId);

      if (error) throw error;

      // Wyślij powiadomienie email
      await supabase.functions.invoke('send-status-notification', {
        body: { reservationId, newStatus }
      });

      await loadReservations();
      setSelectedEvent(null);
    } catch (err) {
      console.error('Error updating reservation:', err);
      setError('Nie udało się zaktualizować statusu rezerwacji');
    }
  };

  const getEventColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#4CAF50'; // Zielony
      case 'pending': return '#FFC107';   // Żółty
      case 'cancelled': return '#F44336'; // Czerwony
      case 'completed': return '#2196F3'; // Niebieski
      default: return '#9E9E9E';          // Szary
    }
  };

  const translateStatus = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Potwierdzona';
      case 'pending': return 'Oczekująca';
      case 'cancelled': return 'Anulowana';
      case 'completed': return 'Zakończona';
      default: return status;
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const tableColumn = ['Data', 'Klient', 'Sprzęt', 'Status', 'Wartość'];
    const tableRows: any[] = [];

    reservations.forEach(reservation => {
      const equipmentList = reservation.items
        .map(item => `${item.equipment.name} (${item.quantity}x)`)
        .join(', ');

      tableRows.push([
        `${new Date(reservation.start_date).toLocaleDateString()} ${reservation.start_time}`,
        `${reservation.customer.first_name} ${reservation.customer.last_name}`,
        equipmentList,
        reservation.status,
        `${reservation.total_price} zł`
      ]);
    });

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [255, 107, 0] }
    });

    doc.save('rezerwacje.pdf');
  };

  const exportToCSV = () => {
    const csvContent = reservations.map(reservation => {
      const equipmentList = reservation.items
        .map(item => `${item.equipment.name} (${item.quantity}x)`)
        .join('; ');

      return [
        new Date(reservation.start_date).toLocaleDateString(),
        reservation.start_time,
        new Date(reservation.end_date).toLocaleDateString(),
        reservation.end_time,
        `${reservation.customer.first_name} ${reservation.customer.last_name}`,
        reservation.customer.email,
        reservation.customer.phone,
        equipmentList,
        reservation.status,
        `${reservation.total_price} zł`
      ].join(',');
    }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'rezerwacje.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderEventContent = (eventInfo: any) => {
    const reservation = reservations.find(r => r.id === eventInfo.event.id);
    if (!reservation) return null;

    return (
      <div className="p-1 overflow-hidden">
        <div className="font-medium text-sm truncate dark:text-white">
          {reservation.customer.first_name} {reservation.customer.last_name}
        </div>
        <div className="text-xs truncate dark:text-gray-300">
          {reservation.items.map(item => item.equipment.name).join(', ')}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <button
              className="px-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-2 dark:text-gray-300"
              onClick={() => document.getElementById('status-filter')?.click()}
            >
              <Filter className="w-4 h-4" />
              <span>Filtruj status</span>
            </button>
            <select
              id="status-filter"
              multiple
              className="absolute opacity-0 invisible"
              value={selectedStatus}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                setSelectedStatus(values);
              }}
            >
              <option value="confirmed">Potwierdzone</option>
              <option value="pending">Oczekujące</option>
              <option value="cancelled">Anulowane</option>
              <option value="completed">Zakończone</option>
            </select>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-2 dark:text-gray-300"
            >
              <Download className="w-4 h-4" />
              <span>PDF</span>
            </button>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-2 dark:text-gray-300"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow fullcalendar-container">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={plLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
          }}
          events={reservations.map(reservation => ({
            id: reservation.id,
            title: `${reservation.customer.first_name} ${reservation.customer.last_name}`,
            start: `${reservation.start_date}T${reservation.start_time}`,
            end: `${reservation.end_date}T${reservation.end_time}`,
            backgroundColor: getEventColor(reservation.status),
            borderColor: getEventColor(reservation.status),
            extendedProps: { reservation }
          }))}
          eventContent={renderEventContent}
          eventClick={(info) => {
            setSelectedEvent(info.event.extendedProps.reservation);
          }}
          height="auto"
          slotMinTime="08:00:00"
          slotMaxTime="16:00:00"
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: '08:00',
            endTime: '16:00'
          }}
          selectConstraint="businessHours"
          nowIndicator
          dayMaxEvents={3}
        />
      </div>

      {/* Modal ze szczegółami rezerwacji */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Szczegóły rezerwacji
                </h3>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">Klient</h4>
                  <p className="dark:text-gray-200">{selectedEvent.customer.first_name} {selectedEvent.customer.last_name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedEvent.customer.email}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedEvent.customer.phone}</p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">Termin</h4>
                  <p className="dark:text-gray-200">
                    {new Date(selectedEvent.start_date).toLocaleDateString()} {selectedEvent.start_time}
                    {' - '}
                    {new Date(selectedEvent.end_date).toLocaleDateString()} {selectedEvent.end_time}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">Sprzęt</h4>
                  <ul className="list-disc list-inside dark:text-gray-200">
                    {selectedEvent.items.map((item, index) => (
                      <li key={index}>
                        {item.equipment.name} (x{item.quantity})
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-700 dark:text-gray-300">Razem</h4>
                  <p className="text-xl font-semibold dark:text-gray-200">{selectedEvent.total_price.toFixed(2)} zł</p>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full text-white bg-blue-500">
                    {translateStatus(selectedEvent.status)}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleStatusChange(selectedEvent.id, 'cancelled')}
                    className="px-4 py-2 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-800"
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedEvent.id, 'confirmed')}
                    className="px-4 py-2 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-lg font-medium hover:bg-green-100 dark:hover:bg-green-800"
                  >
                    Potwierdź
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminCalendar;