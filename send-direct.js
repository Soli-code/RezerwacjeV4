// Bezpośredni test wysyłania maila przez SendGrid API
import sgMail from '@sendgrid/mail';
const API_KEY = process.env.SENDGRID_API_KEY;

sgMail.setApiKey(API_KEY);

const msg = {
  to: 'biuro@solrent.pl',
  from: 'biuro@solrent.pl', // Musi być zweryfikowany w SendGrid
  subject: 'Test bezpośredniego API SendGrid',
  text: 'To jest test bezpośredniego API SendGrid',
  html: '<strong>To jest test bezpośredniego API SendGrid</strong>',
};

sgMail
  .send(msg)
  .then(() => {
    console.log('Email wysłany pomyślnie!');
  })
  .catch((error) => {
    console.error('Błąd podczas wysyłania emaila:');
    console.error(error);
    if (error.response) {
      console.error('Odpowiedź SendGrid:');
      console.error(error.response.body);
    }
  }); 