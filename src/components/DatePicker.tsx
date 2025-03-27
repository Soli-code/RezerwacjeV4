import React, { useState } from 'react';
import { format, addDays, isWithinInterval, isSameDay } from 'date-fns';
import { pl } from 'date-fns/locale';

interface DatePickerProps {
  reservedDates: string[];
  onDateSelect: (startDate: Date | null, endDate: Date | null) => void;
}

const DatePicker: React.FC<DatePickerProps> = ({ reservedDates, onDateSelect }) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const handleDateSelect = (date: Date) => {
    if (!selectedDate) {
      // Wybór daty początkowej
      setSelectedDate(date);
      setStartDate(date);
      setEndDate(null);
      onDateSelect(date, null);
    } else {
      // Sprawdzamy czy wybrana data końcowa jest po dacie początkowej
      if (date > selectedDate) {
        // Sprawdzamy czy wszystkie daty między początkiem a końcem są dostępne
        const isRangeAvailable = checkDateRangeAvailability(selectedDate, date);
        if (isRangeAvailable) {
          setEndDate(date);
          onDateSelect(selectedDate, date);
        } else {
          // Jeśli zakres nie jest dostępny, resetujemy wybór
          setSelectedDate(null);
          setStartDate(null);
          setEndDate(null);
          onDateSelect(null, null);
        }
      } else {
        // Jeśli data końcowa jest wcześniejsza niż początkowa, resetujemy wybór
        setSelectedDate(null);
        setStartDate(null);
        setEndDate(null);
        onDateSelect(null, null);
      }
    }
  };

  // Funkcja sprawdzająca dostępność zakresu dat
  const checkDateRangeAvailability = (start: Date, end: Date): boolean => {
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (reservedDates.includes(dateStr)) {
        return false;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return true;
  };

  const isDateReserved = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return reservedDates.some(reservedDate => {
      const reservedDateStr = reservedDate.split('T')[0];
      return reservedDateStr === dateStr;
    });
  };

  const isDateInRange = (date: Date): boolean => {
    if (!startDate || !endDate) return false;
    return isWithinInterval(date, { start: startDate, end: endDate });
  };

  const isDateSelectable = (date: Date): boolean => {
    // Jeśli data jest zarezerwowana, nie można jej wybrać
    if (isDateReserved(date)) return false;

    // Jeśli nie wybrano jeszcze daty początkowej, można wybrać każdą niezarezerwowaną datę
    if (!selectedDate) return true;

    // Jeśli data jest przed datą początkową, nie można jej wybrać
    if (date < selectedDate) return false;

    // Sprawdzamy wszystkie daty między datą początkową a potencjalną datą końcową
    let currentDate = new Date(selectedDate);
    while (currentDate <= date) {
      if (isDateReserved(currentDate)) {
        return false;
      }
      currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
    }

    return true;
  };

  const renderCalendarDays = () => {
    const days = [];
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const firstDayOfMonth = startOfMonth.getDay();
    const lastDayOfMonth = endOfMonth.getDay();

    // Dodaj puste komórki na początku miesiąca
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-start-${i}`} className="h-10" />);
    }

    // Dodaj dni miesiąca
    for (let i = 1; i <= endOfMonth.getDate(); i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), i);
      const isReserved = isDateReserved(date);
      const isInRange = isDateInRange(date);
      const isSelectable = isDateSelectable(date);
      const isSelected = selectedDate && isSameDay(date, selectedDate);

      days.push(
        <button
          key={i}
          onClick={() => isSelectable && handleDateSelect(date)}
          className={`
            h-10 w-10 rounded-full text-sm font-medium
            ${isReserved ? 'bg-red-100 text-red-600 cursor-not-allowed' : ''}
            ${isInRange ? 'bg-blue-100 text-blue-600' : ''}
            ${isSelected ? 'bg-blue-600 text-white' : ''}
            ${!isSelectable ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-100'}
          `}
          disabled={!isSelectable}
        >
          {i}
        </button>
      );
    }

    // Dodaj puste komórki na końcu miesiąca
    for (let i = lastDayOfMonth + 1; i < 7; i++) {
      days.push(<div key={`empty-end-${i}`} className="h-10" />);
    }

    return days;
  };

  return (
    <div className="w-full max-w-md mx-auto p-4">
      <div className="grid grid-cols-7 gap-1">
        {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
        {renderCalendarDays()}
      </div>
    </div>
  );
};

export default DatePicker; 