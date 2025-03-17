import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface EquipmentDetails {
  id: string;
  name: string;
  purchase_price: number;
  purchase_date: string;
  total_revenue: number;
  payoff_percentage: number;
  rental_history: RentalHistory[];
  monthly_revenue: MonthlyRevenue[];
}

interface RentalHistory {
  id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  customer_name: string;
  status: string;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  cumulative_revenue: number;
}

const EquipmentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [details, setDetails] = useState<EquipmentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadEquipmentDetails();
    } else {
      setError("Nie znaleziono identyfikatora sprzętu");
      setIsLoading(false);
    }
  }, [id]);

  const loadEquipmentDetails = async () => {
    try {
      setIsLoading(true);

      // Pobierz podstawowe informacje o sprzęcie
      const { data: equipment, error: equipmentError } = await supabase
        .from('equipment')
        .select('*')
        .eq('id', id)
        .single();

      if (equipmentError) throw equipmentError;

      // Pobierz elementy rezerwacji dla danego sprzętu
      const { data: reservationItems, error: reservationItemsError } = await supabase
        .from('reservation_items')
        .select('reservation_id, quantity')
        .eq('equipment_id', id);

      if (reservationItemsError) throw reservationItemsError;

      if (!reservationItems || reservationItems.length === 0) {
        // Jeśli nie ma rezerwacji, zwróć podstawowe dane sprzętu bez historii
        setDetails({
          ...equipment,
          total_revenue: 0,
          payoff_percentage: 0,
          rental_history: [],
          monthly_revenue: []
        });
        setError(null);
        setIsLoading(false);
        return;
      }

      // Pobierz rezerwacje na podstawie reservation_id
      const reservationIds = reservationItems.map(ri => ri.reservation_id);
      const { data: rentals, error: rentalsError } = await supabase
        .from('reservations')
        .select(`
          id,
          start_date,
          end_date,
          total_price,
          status,
          customers (
            first_name,
            last_name
          )
        `)
        .in('id', reservationIds)
        .order('start_date', { ascending: false });

      if (rentalsError) throw rentalsError;

      // Przygotuj dane miesięcznych przychodów
      const monthlyData = rentals
        .filter(rental => rental.status === 'completed')
        .reduce((acc: { [key: string]: number }, rental) => {
          const month = new Date(rental.start_date).toISOString().slice(0, 7);
          acc[month] = (acc[month] || 0) + rental.total_price;
          return acc;
        }, {});

      const sortedMonths = Object.keys(monthlyData).sort();
      let cumulativeRevenue = 0;
      const monthlyRevenue = sortedMonths.map(month => {
        cumulativeRevenue += monthlyData[month];
        return {
          month,
          revenue: monthlyData[month],
          cumulative_revenue: cumulativeRevenue
        };
      });

      const rentalHistory = rentals.map(rental => ({
        id: rental.id,
        start_date: rental.start_date,
        end_date: rental.end_date,
        total_price: rental.total_price,
        customer_name: rental.customers ? `${rental.customers.first_name} ${rental.customers.last_name}` : 'Nieznany klient',
        status: rental.status
      }));

      // Oblicz całkowity przychód i procent spłaty
      const totalRevenue = rentals
        .filter(rental => rental.status === 'completed')
        .reduce((sum, rental) => sum + (rental.total_price || 0), 0);
      
      const payoffPercentage = equipment.purchase_price 
        ? (totalRevenue / equipment.purchase_price) * 100 
        : 0;

      setDetails({
        ...equipment,
        total_revenue: totalRevenue,
        payoff_percentage: payoffPercentage,
        rental_history: rentalHistory,
        monthly_revenue: monthlyRevenue
      });

      setError(null);
    } catch (err) {
      console.error('Error loading equipment details:', err);
      setError('Nie udało się załadować szczegółów sprzętu');
    } finally {
      setIsLoading(false);
    }
  };

  const getEstimatedPayoffDate = () => {
    if (!details || details.payoff_percentage >= 100) return null;

    const monthlyRevenue = details.monthly_revenue;
    if (monthlyRevenue.length < 2) return null;

    // Oblicz średni miesięczny przychód z ostatnich 3 miesięcy
    const recentMonths = monthlyRevenue.slice(-3);
    const avgMonthlyRevenue = recentMonths.reduce((sum, month) => sum + month.revenue, 0) / recentMonths.length;

    if (avgMonthlyRevenue <= 0) return null;

    // Oblicz pozostałą kwotę do spłaty
    const remainingAmount = details.purchase_price - details.total_revenue;
    const monthsToPayoff = Math.ceil(remainingAmount / avgMonthlyRevenue);

    const estimatedDate = new Date();
    estimatedDate.setMonth(estimatedDate.getMonth() + monthsToPayoff);
    return estimatedDate.toLocaleDateString('pl-PL');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-solrent-orange animate-spin" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="bg-red-50 p-4 rounded-lg text-red-700">
        <p>{error || 'Nie znaleziono sprzętu'}</p>
      </div>
    );
  }

  const chartData = {
    labels: details.monthly_revenue.map(m => {
      const [year, month] = m.month.split('-');
      return `${month}/${year}`;
    }),
    datasets: [
      {
        label: 'Miesięczny przychód',
        data: details.monthly_revenue.map(m => m.revenue),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1
      },
      {
        label: 'Przychód skumulowany',
        data: details.monthly_revenue.map(m => m.cumulative_revenue),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Przychody w czasie'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number) => `${value.toFixed(2)} zł`
        }
      }
    }
  };

  const estimatedPayoffDate = getEstimatedPayoffDate();

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">{details.name}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Cena zakupu</p>
            <p className="text-xl font-medium text-gray-900">{details.purchase_price.toFixed(2)} zł</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Przychód łączny</p>
            <p className="text-xl font-medium text-gray-900">{details.total_revenue.toFixed(2)} zł</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Postęp spłaty</p>
            <p className="text-xl font-medium text-gray-900">{details.payoff_percentage.toFixed(1)}%</p>
          </div>
        </div>

        {estimatedPayoffDate && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Szacowana data pełnej spłaty: <span className="font-medium">{estimatedPayoffDate}</span>
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Wykres przychodów</h3>
        <Line data={chartData} options={chartOptions} />
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Historia wypożyczeń</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data rozpoczęcia
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data zakończenia
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Klient
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kwota
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {details.rental_history.map((rental) => (
                <tr key={rental.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(rental.start_date).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(rental.end_date).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rental.customer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rental.total_price.toFixed(2)} zł
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      rental.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : rental.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rental.status === 'completed' ? 'Zakończone' : 
                       rental.status === 'pending' ? 'Oczekujące' : 
                       rental.status === 'cancelled' ? 'Anulowane' : 
                       rental.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EquipmentDetails; 