import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Tworzymy klienta Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Pobieramy rezerwacje zakończone ponad 24h temu
    const { data: completedReservations, error: fetchError } = await supabaseClient
      .from('reservations')
      .select('*')
      .eq('status', 'completed')
      .lt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (fetchError) throw fetchError

    if (completedReservations && completedReservations.length > 0) {
      // Aktualizujemy status na historyczny
      const { error: updateError } = await supabaseClient
        .from('reservations')
        .update({ status: 'archived' })
        .in('id', completedReservations.map(r => r.id))

      if (updateError) throw updateError

      // Dodajemy wpisy do historii statusów
      const historyEntries = completedReservations.map(reservation => ({
        reservation_id: reservation.id,
        previous_status: 'completed',
        new_status: 'archived',
        changed_at: new Date().toISOString(),
        comment: 'Automatyczne przeniesienie do historycznych po 24 godzinach'
      }))

      const { error: historyError } = await supabaseClient
        .from('reservation_status_history')
        .insert(historyEntries)

      if (historyError) throw historyError

      return new Response(
        JSON.stringify({
          message: `Przeniesiono ${completedReservations.length} rezerwacji do historycznych`,
          count: completedReservations.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        message: 'Brak rezerwacji do przeniesienia',
        count: 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 