// Test wysyłania maila przez Edge Function
fetch('https://klumxecllfauamqnrckf.supabase.co/functions/v1/send-email', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsdW14ZWNsbGZhdWFtcW5yY2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NDcyNzUsImV4cCI6MjA1NzIyMzI3NX0.S20v_K_5pDY0oA-4ztB1mlRWRF4vyt-NETZkvyx0PjE',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: 'biuro@solrent.pl',
    subject: 'Test Edge Function - z nowym API SendGrid',
    html: '<h1>Test wysyłania maila</h1><p>To jest testowa wiadomość wysłana przez Edge Function z nowym kluczem API SendGrid</p><p>Data i czas: ' + new Date().toLocaleString('pl-PL') + '</p>'
  })
})
.then(async response => {
  console.log('Status odpowiedzi:', response.status);
  try {
    const text = await response.text();
    console.log('Odpowiedź serwera:', text);
    return text ? JSON.parse(text) : {};
  } catch (e) {
    console.error('Błąd parsowania odpowiedzi:', e);
    return {};
  }
})
.then(data => console.log('Dane:', data))
.catch(error => console.error('Błąd:', error)); 