import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface EmailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Sprawdź, czy klucz API SendGrid jest dostępny
  if (!SENDGRID_API_KEY) {
    console.error("Brak klucza API SendGrid");
    return new Response(
      JSON.stringify({ error: "Brak klucza API SendGrid" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { to, subject, html, text }: EmailRequest = await req.json();

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: "Wymagane pola: to, subject i (html lub text)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Walidacja adresu email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: "Nieprawidłowy format adresu email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Wysyłanie emaila do: ${to}, temat: ${subject}`);

    // Przygotowanie wiadomości
    const message = {
      personalizations: [
        {
          to: [{ email: to }],
        },
      ],
      from: {
        email: "biuro@solrent.pl",
        name: "SOLRENT",
      },
      subject,
      content: [
        {
          type: "text/html",
          value: html || text,
        },
      ],
    };

    // Wysłanie emaila za pomocą bezpośredniego API SendGrid
    const sendgridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!sendgridResponse.ok) {
      const errorData = await sendgridResponse.text();
      console.error(`Błąd SendGrid (${sendgridResponse.status}):`, errorData);
      return new Response(
        JSON.stringify({ 
          error: `Błąd SendGrid: ${errorData}`,
          status: sendgridResponse.status 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Email wysłany pomyślnie do: ${to}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email został wysłany" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Błąd podczas wysyłania emaila:", error);
    
    return new Response(
      JSON.stringify({ error: `Błąd: ${error.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}); 