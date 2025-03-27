import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { supabase } from '../../lib/supabase';
import { 
  User, Phone, Mail, Calendar, Package, 
  CheckCircle, XCircle, Clock, AlertCircle,
  Building2, FileText, ExternalLink, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PipelineColumn {
  id: string;
  title: string;
  reservations: Reservation[];
}

interface Reservation {
  id: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    company_name?: string;
    company_nip?: string;
  };
  dates: {
    start: string;
    end: string;
  };
  total_price: number;
  items: Array<{
    id: string;
    equipment_name: string;
    quantity: number;
  }>;
  history?: Array<{
    changed_at: string;
    previous_status: string;
    new_status: string;
    comment?: string;
  }>;
}

const Pipeline: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadPipelineData();
    subscribeToUpdates();
  }, []);

  const loadPipelineData = async () => {
    try {
      setLoading(true);
      
      // Tworzymy domyślną strukturę kolumn
      const defaultColumns: PipelineColumn[] = [
        {
          id: 'pending',
          title: 'Oczekujące',
          reservations: []
        },
        {
          id: 'confirmed',
          title: 'Potwierdzone',
          reservations: []
        },
        {
          id: 'picked_up',
          title: 'Odebrane',
          reservations: []
        },
        {
          id: 'completed',
          title: 'Zakończone',
          reservations: []
        },
        {
          id: 'archived',
          title: 'Historyczne',
          reservations: []
        },
        {
          id: 'cancelled',
          title: 'Anulowane',
          reservations: []
        }
      ];
      
      try {
        // Próba pobrania danych przez RPC
        const { data, error } = await supabase.rpc('get_admin_pipeline_data', {
          p_date_range: '30days',
          p_status: ['pending', 'confirmed', 'picked_up', 'completed', 'archived', 'cancelled']
        });
        
        if (!error && data && data.columns) {
          console.log('Dane z RPC:', data.columns);
          // Zachowaj domyślne tytuły kolumn, aktualizuj tylko rezerwacje
          const updatedColumns = defaultColumns.map(defaultColumn => {
            const matchingColumn = data.columns.find((c: any) => c.id === defaultColumn.id);
            return {
              ...defaultColumn,
              reservations: matchingColumn?.reservations || []
            };
          });
          setColumns(updatedColumns);
          setLoading(false);
          return;
        }
      } catch (rpcError) {
        console.error('RPC Error:', rpcError);
        // Kontynuuj do fallbacku
      }
      
      // Fallback: pobierz rezerwacje bezpośrednio
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select(`
          id,
          status,
          start_date,
          end_date,
          start_time,
          end_time,
          total_price,
          customers (
            id,
            first_name,
            last_name,
            email,
            phone,
            company_name,
            company_nip
          ),
          reservation_items (
            id,
            equipment_id,
            equipment:equipment (
              name
            ),
            quantity
          )
        `);
        
      if (reservationsError) {
        throw reservationsError;
      }
      
      if (reservationsData) {
        console.log('Dane z fallbacku:', reservationsData);
        // Przekształcenie danych rezerwacji do wymaganego formatu
        const newColumns = [...defaultColumns];
        
        reservationsData.forEach((reservation: any) => {
          const columnId = reservation.status || 'pending';
          const columnIndex = newColumns.findIndex(c => c.id === columnId);
          
          if (columnIndex >= 0) {
            const formattedReservation: Reservation = {
              id: reservation.id,
              customer: {
                id: reservation.customers?.id || '',
                first_name: reservation.customers?.first_name || '',
                last_name: reservation.customers?.last_name || '',
                email: reservation.customers?.email || '',
                phone: reservation.customers?.phone || '',
                company_name: reservation.customers?.company_name,
                company_nip: reservation.customers?.company_nip
              },
              dates: {
                start: reservation.start_date || new Date().toISOString(),
                end: reservation.end_date || new Date().toISOString()
              },
              total_price: reservation.total_price || 0,
              items: Array.isArray(reservation.reservation_items) 
                ? reservation.reservation_items.map((item: any) => ({
                    id: item.id || `temp-${Math.random().toString(36).substring(2, 9)}`,
                    equipment_name: item.equipment?.name || 'Nieznany sprzęt',
                    quantity: item.quantity || 1
                  }))
                : []
            };
            
            newColumns[columnIndex].reservations.push(formattedReservation);
          }
        });
        
        console.log('Przekształcone kolumny:', newColumns);
        setColumns(newColumns);
      } else {
        // Brak danych, ustaw puste kolumny
        setColumns(defaultColumns);
      }
    } catch (err) {
      console.error('Error loading pipeline data:', err);
      setError('Nie udało się załadować danych');
      // Utwórz pustą strukturę danych
      setColumns([
        {
          id: 'pending',
          title: 'Oczekujące',
          reservations: []
        },
        {
          id: 'confirmed',
          title: 'Potwierdzone',
          reservations: []
        },
        {
          id: 'picked_up',
          title: 'Odebrane',
          reservations: []
        },
        {
          id: 'completed',
          title: 'Zakończone',
          reservations: []
        },
        {
          id: 'archived',
          title: 'Historyczne',
          reservations: []
        },
        {
          id: 'cancelled',
          title: 'Anulowane',
          reservations: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel('pipeline_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => loadPipelineData()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    
    if (!over) return;

    const activeReservation = findReservation(active.id);
    const newStatus = over.id;

    if (activeReservation && activeReservation.id !== newStatus) {
      try {
        await supabase.rpc('update_reservation_pipeline_status', {
          p_reservation_id: activeReservation.id,
          p_new_status: newStatus
        });

        await loadPipelineData();
      } catch (err) {
        console.error('Error updating reservation status:', err);
        setError('Nie udało się zaktualizować statusu');
      }
    }

    setActiveId(null);
  };

  const findReservation = (id: string): Reservation | null => {
    for (const column of columns) {
      const reservation = column.reservations?.find(r => r.id === id);
      if (reservation) return reservation;
    }
    return null;
  };

  const handleStatusChange = async (reservationId: string, newStatus: string) => {
    try {
      await supabase.rpc('update_reservation_pipeline_status', {
        p_reservation_id: reservationId,
        p_new_status: newStatus
      });
      await loadPipelineData();
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Nie udało się zaktualizować statusu');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-solrent-orange"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg text-red-700 flex items-center">
        <AlertTriangle className="w-6 h-6 mr-2" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)]">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 pb-6 h-full overflow-x-auto whitespace-nowrap" style={{ minWidth: 'max-content' }}>
          {columns.map(column => (
            <div
              key={column.id}
              className="inline-block w-[360px] bg-gray-50 rounded-lg p-4 h-fit align-top"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-900 flex items-center">
                  {column.title}
                  <span className="ml-2 bg-white text-gray-600 px-2 py-0.5 rounded-full text-sm border">
                    {column.reservations?.length || 0}
                  </span>
                </h3>
              </div>

              <SortableContext
                items={column.reservations?.map(r => r.id) || []}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {column.reservations && column.reservations.length > 0 ? (
                    column.reservations.map((reservation) => (
                      <motion.div
                        key={reservation.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md hover:bg-gray-50 transition-all ${
                          activeId === reservation.id ? 'ring-2 ring-solrent-orange' : ''
                        }`}
                        onClick={() => {
                          navigate(`/admin/panel/reservations/${reservation.id}`, {
                            state: { from: location.pathname + location.search }
                          });
                        }}
                      >
                        {/* Nagłówek karty */}
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900 text-sm">
                              {reservation.customer?.first_name || ''} {reservation.customer?.last_name || ''}
                            </h4>
                            <div className="flex items-center text-xs text-gray-500 mt-1">
                              <Mail className="w-4 h-4 mr-1" />
                              {reservation.customer?.email || ''}
                            </div>
                            <div className="flex items-center text-xs text-gray-500 mt-1">
                              <Phone className="w-4 h-4 mr-1" />
                              {reservation.customer?.phone || ''}
                            </div>
                            {reservation.customer?.company_name && (
                              <div className="flex items-center text-xs text-gray-500 mt-1">
                                <Building2 className="w-4 h-4 mr-1" />
                                {reservation.customer.company_name}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Daty rezerwacji */}
                        <div className="flex items-center text-xs text-gray-600 mb-2 bg-gray-50 p-2 rounded">
                          <Calendar className="w-4 h-4 mr-1" />
                          <span>
                            {reservation.dates?.start ? new Date(reservation.dates.start).toLocaleDateString() : ''} - 
                            {reservation.dates?.end ? new Date(reservation.dates.end).toLocaleDateString() : ''}
                          </span>
                        </div>

                        {/* Lista sprzętu */}
                        <div className="space-y-1.5 mb-3">
                          {Array.isArray(reservation.items) && reservation.items.map((item, idx) => (
                            <div key={idx} className="flex items-center text-xs bg-gray-50 p-1.5 rounded">
                              <Package className="w-4 h-4 mr-1 text-gray-400" />
                              <span>{item.equipment_name || 'Nieznany sprzęt'} (x{item.quantity || 1})</span>
                            </div>
                          ))}
                        </div>

                        {/* Stopka karty */}
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="font-medium text-solrent-orange text-sm">
                            {typeof reservation.total_price === 'number' ? reservation.total_price.toFixed(2) : '0.00'} zł
                          </span>
                          <div className="flex space-x-2">
                            {column.id === 'pending' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(reservation.id, 'confirmed');
                                  }}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-full"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(reservation.id, 'cancelled');
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-full"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {column.id === 'confirmed' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(reservation.id, 'picked_up');
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {column.id === 'picked_up' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(reservation.id, 'completed');
                                }}
                                className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-full"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : null}
                </div>
              </SortableContext>
            </div>
          ))}
        </div>
        <DragOverlay>
          {activeId ? (
            <div className="bg-white rounded-lg shadow-lg p-4 opacity-90">
              {(() => {
                const reservation = findReservation(activeId);
                if (!reservation) return null;
                return (
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {reservation.customer?.first_name || ''} {reservation.customer?.last_name || ''}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {reservation.dates?.start ? new Date(reservation.dates.start).toLocaleDateString() : ''}
                    </p>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default Pipeline;