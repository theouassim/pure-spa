import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "Pure Spa Institut <noreply@purespa-institut.fr>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "contact@purespa-institut.fr";

interface BookingEmailData {
  clientNom: string;
  clientEmail: string;
  serviceNom: string;
  date: string; // "Mercredi 12 mars 2025"
  heure: string; // "14:30"
  duree: number; // minutes
  montant: number | null; // centimes
  statutPaiement: string;
}

function formatMontant(centimes: number | null): string {
  if (!centimes) return "—";
  return `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
}

function formatDate(isoDate: string): { date: string; heure: string } {
  const d = new Date(isoDate);
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
  return {
    date: formatter.format(d),
    heure: timeFormatter.format(d),
  };
}

export function buildEmailData(booking: {
  start_at: string;
  montant: number | null;
  statut_paiement: string;
}, client: { nom: string; email: string }, service: { nom: string; duree_minutes: number }): BookingEmailData {
  const { date, heure } = formatDate(booking.start_at);
  return {
    clientNom: client.nom,
    clientEmail: client.email,
    serviceNom: service.nom,
    date,
    heure,
    duree: service.duree_minutes,
    montant: booking.montant,
    statutPaiement: booking.statut_paiement,
  };
}

// --- Templates HTML ---

function confirmationClientHtml(data: BookingEmailData): string {
  const paiementLine = data.statutPaiement === "paye_en_ligne"
    ? `<p style="color:#059669;font-weight:600;">✓ Payé en ligne — ${formatMontant(data.montant)}</p>`
    : `<p>Paiement sur place — ${formatMontant(data.montant)}</p>`;

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#fafafa;border-radius:12px;">
      <h1 style="color:#1a1a1a;font-size:24px;margin-bottom:8px;">Réservation confirmée</h1>
      <p style="color:#555;margin-bottom:24px;">Bonjour ${data.clientNom},</p>
      <div style="background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;"><strong>Soin :</strong> ${data.serviceNom}</p>
        <p style="margin:0 0 8px;"><strong>Date :</strong> ${data.date}</p>
        <p style="margin:0 0 8px;"><strong>Heure :</strong> ${data.heure}</p>
        <p style="margin:0 0 8px;"><strong>Durée :</strong> ${data.duree} min</p>
        ${paiementLine}
      </div>
      <p style="color:#555;font-size:14px;">À bientôt chez Pure Spa Institut !</p>
      <p style="color:#999;font-size:12px;margin-top:24px;">Si vous souhaitez annuler ou modifier votre rendez-vous, contactez-nous par téléphone.</p>
    </div>
  `;
}

function confirmationAdminHtml(data: BookingEmailData): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h1 style="font-size:20px;color:#1a1a1a;">Nouvelle réservation</h1>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <tr><td style="padding:8px 0;color:#666;">Cliente</td><td style="padding:8px 0;font-weight:600;">${data.clientNom} (${data.clientEmail})</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Soin</td><td style="padding:8px 0;">${data.serviceNom}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Date</td><td style="padding:8px 0;">${data.date} à ${data.heure}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Durée</td><td style="padding:8px 0;">${data.duree} min</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Montant</td><td style="padding:8px 0;">${formatMontant(data.montant)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Paiement</td><td style="padding:8px 0;">${data.statutPaiement.replace(/_/g, " ")}</td></tr>
      </table>
    </div>
  `;
}

function annulationClientHtml(data: BookingEmailData): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#fafafa;border-radius:12px;">
      <h1 style="color:#dc2626;font-size:24px;margin-bottom:8px;">Rendez-vous annulé</h1>
      <p style="color:#555;margin-bottom:24px;">Bonjour ${data.clientNom},</p>
      <p style="color:#555;">Votre rendez-vous a été annulé :</p>
      <div style="background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:24px;margin:16px 0 24px;">
        <p style="margin:0 0 8px;"><strong>Soin :</strong> ${data.serviceNom}</p>
        <p style="margin:0 0 8px;"><strong>Date :</strong> ${data.date} à ${data.heure}</p>
      </div>
      <p style="color:#555;font-size:14px;">N'hésitez pas à reprendre rendez-vous quand vous le souhaitez.</p>
    </div>
  `;
}

function annulationAdminHtml(data: BookingEmailData): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
      <h1 style="font-size:20px;color:#dc2626;">Réservation annulée</h1>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <tr><td style="padding:8px 0;color:#666;">Cliente</td><td style="padding:8px 0;font-weight:600;">${data.clientNom} (${data.clientEmail})</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Soin</td><td style="padding:8px 0;">${data.serviceNom}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Date</td><td style="padding:8px 0;">${data.date} à ${data.heure}</td></tr>
      </table>
    </div>
  `;
}

// --- Envoi ---

export async function sendConfirmationClient(data: BookingEmailData) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.clientEmail,
    subject: `Réservation confirmée — ${data.serviceNom} le ${data.date}`,
    html: confirmationClientHtml(data),
  });
}

export async function sendConfirmationAdmin(data: BookingEmailData) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Nouvelle réservation — ${data.clientNom} — ${data.serviceNom}`,
    html: confirmationAdminHtml(data),
  });
}

export async function sendAnnulationClient(data: BookingEmailData) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: data.clientEmail,
    subject: `Rendez-vous annulé — ${data.serviceNom}`,
    html: annulationClientHtml(data),
  });
}

export async function sendAnnulationAdmin(data: BookingEmailData) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Annulation — ${data.clientNom} — ${data.serviceNom}`,
    html: annulationAdminHtml(data),
  });
}

export async function sendBookingConfirmation(booking: {
  start_at: string;
  montant: number | null;
  statut_paiement: string;
}, client: { nom: string; email: string }, service: { nom: string; duree_minutes: number }) {
  const data = buildEmailData(booking, client, service);
  await Promise.all([
    sendConfirmationClient(data),
    sendConfirmationAdmin(data),
  ]);
}

export async function sendBookingCancellation(booking: {
  start_at: string;
  montant: number | null;
  statut_paiement: string;
}, client: { nom: string; email: string }, service: { nom: string; duree_minutes: number }) {
  const data = buildEmailData(booking, client, service);
  await Promise.all([
    sendAnnulationClient(data),
    sendAnnulationAdmin(data),
  ]);
}
