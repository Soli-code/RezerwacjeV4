import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, Download, Grid, List, Search, SlidersHorizontal } from 'lucide-react';
import * as XLSX from 'xlsx';

interface EquipmentStats {
  id: string;
  name: string;
  purchase_price: number;
  purchase_date: string;
  total_revenue: number;
  payoff_percentage: number;
}

interface Filters {
  search: string;
  payoffStatus: 'all' | 'paid' | 'pending';
  sortBy: 'name' | 'purchase_price' | 'total_revenue' | 'payoff_percentage';
  sortOrder: 'asc' | 'desc';
}

const EquipmentStats: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<EquipmentStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [filters, setFilters] = useState<Filters>({
    search: '',
    payoffStatus: 'all',
    sortBy: 'name',
    sortOrder: 'asc'
  });
  const [isFiltersPanelOpen, setIsFiltersPanelOpen] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      
      // Pobierz sprzęt z ceną zakupu
      const { data: equipment, error: equipmentError } = await supabase
        .from('equipment')
        .select('id, name, purchase_price, purchase_date, price');

      if (equipmentError) {
        console.error('Błąd pobierania sprzętu:', equipmentError);
        throw equipmentError;
      }

      if (!equipment || equipment.length === 0) {
        setStats([]);
        setIsLoading(false);
        return;
      }

      // Pobierz elementy rezerwacji dla wszystkich zakończonych rezerwacji
      const { data: reservationItems, error: reservationItemsError } = await supabase
        .from('reservation_items')
        .select(`
          id, 
          equipment_id, 
          quantity, 
          price_per_day,
          reservation_id,
          reservations!inner(status)
        `)
        .eq('reservations.status', 'completed');

      if (reservationItemsError) {
        console.error('Błąd pobierania elementów rezerwacji:', reservationItemsError);
        throw reservationItemsError;
      }

      // Oblicz rzeczywisty przychód dla każdego sprzętu na podstawie reservation_items
      const revenueByEquipment: Record<string, number> = {};
      
      // Dla każdego elementu rezerwacji, oblicz przychód jako (cena za dzień * ilość)
      // i przypisz go do odpowiedniego sprzętu
      if (reservationItems && reservationItems.length > 0) {
        // Pobierz długości rezerwacji
        const reservationIds = [...new Set(reservationItems.map(item => item.reservation_id))];
        const { data: reservations, error: reservationsError } = await supabase
          .from('reservations')
          .select('id, rental_days, start_date, end_date')
          .in('id', reservationIds);

        if (reservationsError) {
          console.error('Błąd pobierania dni rezerwacji:', reservationsError);
          throw reservationsError;
        }

        // Utwórz mapę dni rezerwacji
        const rentalDaysByReservation: Record<string, number> = {};
        reservations?.forEach(res => {
          // Jeśli rezerwacja ma ustawione dni, użyj tej wartości
          if (res.rental_days) {
            rentalDaysByReservation[res.id] = res.rental_days;
          } else if (res.start_date && res.end_date) {
            // W przeciwnym razie oblicz liczbę dni na podstawie dat
            const start = new Date(res.start_date);
            const end = new Date(res.end_date);
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            rentalDaysByReservation[res.id] = Math.max(1, days); // Minimum 1 dzień
          } else {
            rentalDaysByReservation[res.id] = 1; // Domyślnie 1 dzień
          }
        });

        // Oblicz przychód dla każdego sprzętu
        reservationItems.forEach(item => {
          if (!item.equipment_id) return;
          
          const days = rentalDaysByReservation[item.reservation_id] || 1;
          // Oblicz przychód jako: cena za dzień * ilość * liczba dni
          const itemRevenue = (item.price_per_day || 0) * (item.quantity || 1) * days;
          
          // Dodaj przychód do sumy dla tego sprzętu
          revenueByEquipment[item.equipment_id] = (revenueByEquipment[item.equipment_id] || 0) + itemRevenue;
        });
      }

      // Utwórz statystyki dla każdego sprzętu
      const validStats = equipment.map(item => {
        const purchase_price = Number(item.purchase_price) || 0;
        const total_revenue = revenueByEquipment[item.id] || 0;
        const payoff_percentage = purchase_price > 0 ? (total_revenue / purchase_price) * 100 : 0;
        
        return {
          id: item.id || '',
          name: item.name || 'Nieznany produkt',
          purchase_price: purchase_price,
          purchase_date: item.purchase_date || new Date().toISOString(),
          total_revenue: total_revenue,
          payoff_percentage: payoff_percentage
        };
      });

      setStats(validStats);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Nie udało się załadować statystyk. Spróbuj odświeżyć stronę.');
      setIsLoading(false);
    }
  };

  const getPayoffStatusColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-emerald-400';
    if (percentage >= 50) return 'bg-yellow-400';
    if (percentage >= 25) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const filteredStats = useMemo(() => {
    return stats
      .filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(filters.search.toLowerCase());
        const matchesStatus = filters.payoffStatus === 'all' 
          ? true 
          : filters.payoffStatus === 'paid' 
            ? item.payoff_percentage >= 100 
            : item.payoff_percentage < 100;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const getValue = (item: EquipmentStats) => {
          switch (filters.sortBy) {
            case 'name': return item.name;
            case 'purchase_price': return item.purchase_price;
            case 'total_revenue': return item.total_revenue;
            case 'payoff_percentage': return item.payoff_percentage;
            default: return item.name;
          }
        };

        const aValue = getValue(a);
        const bValue = getValue(b);

        if (typeof aValue === 'string') {
          return filters.sortOrder === 'asc'
            ? aValue.localeCompare(bValue as string)
            : (bValue as string).localeCompare(aValue);
        }

        return filters.sortOrder === 'asc'
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      });
  }, [stats, filters]);

  const handleExportToExcel = () => {
    const exportData = filteredStats.map(item => ({
      'Nazwa sprzętu': item.name,
      'Cena zakupu (zł)': item.purchase_price.toFixed(2),
      'Przychód łączny (zł)': item.total_revenue.toFixed(2),
      'Postęp spłaty (%)': item.payoff_percentage.toFixed(1),
      'Status': item.payoff_percentage >= 100 ? 'Spłacono' : 'W trakcie',
      'Data zakupu': new Date(item.purchase_date).toLocaleDateString('pl-PL')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statystyki sprzętu');

    // Dostosuj szerokość kolumn
    const colWidths = [
      { wch: 30 }, // Nazwa sprzętu
      { wch: 15 }, // Cena zakupu
      { wch: 15 }, // Przychód łączny
      { wch: 15 }, // Postęp spłaty
      { wch: 12 }, // Status
      { wch: 12 }  // Data zakupu
    ];
    ws['!cols'] = colWidths;

    // Zapisz plik
    XLSX.writeFile(wb, `Statystyki_sprzętu_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleItemClick = (id: string) => {
    navigate(`/admin/panel/equipment-stats/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-solrent-orange animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg text-red-700">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-900">Statystyki spłaty sprzętu</h2>
        <div className="flex gap-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
              title="Widok tabeli"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
              }`}
              title="Widok kafelków"
            >
              <Grid className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => setIsFiltersPanelOpen(!isFiltersPanelOpen)}
            className={`p-2 rounded-lg transition-colors ${
              isFiltersPanelOpen ? 'bg-gray-200' : 'bg-gray-100 hover:bg-gray-200'
            }`}
            title="Filtry"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
          <button
            onClick={handleExportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Eksportuj do Excel
          </button>
        </div>
      </div>

      {/* Panel filtrów */}
      {isFiltersPanelOpen && (
        <div className="bg-white rounded-lg shadow-lg p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Wyszukaj
            </label>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Nazwa sprzętu..."
                className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status spłaty
            </label>
            <select
              value={filters.payoffStatus}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                payoffStatus: e.target.value as Filters['payoffStatus']
              }))}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange"
            >
              <option value="all">Wszystkie</option>
              <option value="paid">Spłacone</option>
              <option value="pending">W trakcie spłaty</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sortuj według
            </label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                sortBy: e.target.value as Filters['sortBy']
              }))}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange"
            >
              <option value="name">Nazwa</option>
              <option value="purchase_price">Cena zakupu</option>
              <option value="total_revenue">Przychód</option>
              <option value="payoff_percentage">Postęp spłaty</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kolejność
            </label>
            <select
              value={filters.sortOrder}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                sortOrder: e.target.value as Filters['sortOrder']
              }))}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-solrent-orange focus:ring-solrent-orange"
            >
              <option value="asc">Rosnąco</option>
              <option value="desc">Malejąco</option>
            </select>
          </div>
        </div>
      )}

      {viewMode === 'table' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nazwa sprzętu
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cena zakupu
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Przychód łączny
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Postęp spłaty
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStats.map((item) => (
                <tr 
                  key={item.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleItemClick(item.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{item.purchase_price.toFixed(2)} zł</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{item.total_revenue.toFixed(2)} zł</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${getPayoffStatusColor(item.payoff_percentage)}`}
                        style={{ width: `${Math.min(item.payoff_percentage, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {item.payoff_percentage.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        item.payoff_percentage >= 100
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {item.payoff_percentage >= 100 ? 'Spłacono' : 'W trakcie'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredStats.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => handleItemClick(item.id)}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{item.name}</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Cena zakupu</p>
                  <p className="text-lg font-medium text-gray-900">{item.purchase_price.toFixed(2)} zł</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Przychód łączny</p>
                  <p className="text-lg font-medium text-gray-900">{item.total_revenue.toFixed(2)} zł</p>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-sm text-gray-500">Postęp spłaty</p>
                    <span className="text-sm font-medium text-gray-700">
                      {item.payoff_percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${getPayoffStatusColor(item.payoff_percentage)}`}
                      style={{ width: `${Math.min(item.payoff_percentage, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      item.payoff_percentage >= 100
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {item.payoff_percentage >= 100 ? 'Spłacono' : 'W trakcie'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EquipmentStats; 