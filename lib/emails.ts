import { Resend } from "resend";
import { supabaseAdmin } from "./supabase-admin";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "Pure Spa Institut <noreply@purespainstitut.com>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "contact@purespainstitut.com";
const LOGO_URL = "https://booking.purespainstitut.com/logo.png";

const INSTITUT_NOM = "Pure SPA — Hair Spa Institut";
const INSTITUT_ADRESSE = "123 rue du Spa, 75001 Paris";
const INSTITUT_TELEPHONE = "01 23 45 67 89";

// --- Types ---

export interface BookingEmailData {
  bookingId: string;
  clientNom: string;
  clientEmail: string | null;
  serviceNom: string;
  date: string;
  heure: string;
  duree: number;
  montant: number | null;
  statutPaiement: string;
}

// --- Formatage ---

function formatMontant(centimes: number | null): string {
  if (!centimes) return "Gratuit";
  return `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
}

function formatStatutPaiement(statut: string): string {
  switch (statut) {
    case "paye_en_ligne": return "Payé en ligne";
    case "paye_sur_place": return "Réglé sur place";
    case "en_attente": return "À régler sur place";
    default: return statut;
  }
}

function formatDate(isoDate: string): { date: string; heure: string; dateShort: string } {
  const d = new Date(isoDate);
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const shortFormatter = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
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
    dateShort: shortFormatter.format(d),
  };
}

export function buildEmailData(
  booking: { id: string; start_at: string; montant: number | null; statut_paiement: string },
  client: { nom: string; email: string | null },
  service: { nom: string; duree_minutes: number }
): BookingEmailData {
  const { date, heure } = formatDate(booking.start_at);
  return {
    bookingId: booking.id,
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

// --- Layout email ---

const COLORS = {
  primary: "#8b6f5c",
  primaryDark: "#6d5648",
  accent: "#d4a98a",
  accentLight: "#f0e6de",
  bg: "#faf8f6",
  bgCard: "#ffffff",
  text: "#2d2926",
  textMuted: "#6b5e57",
  border: "#e8e0da",
  success: "#4a8c6f",
  error: "#c75050",
};

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${COLORS.text};line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="${LOGO_URL}" alt="Pure SPA" width="180" style="display:block;height:auto;max-width:180px;" />
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:${COLORS.bgCard};border-radius:12px;border:1px solid ${COLORS.border};padding:40px 36px;box-shadow:0 2px 12px rgba(0,0,0,0.04);">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:${COLORS.textMuted};">${INSTITUT_NOM}</p>
              <p style="margin:0 0 4px;font-size:13px;color:${COLORS.textMuted};">${INSTITUT_ADRESSE}</p>
              <p style="margin:0 0 12px;font-size:13px;color:${COLORS.textMuted};">${INSTITUT_TELEPHONE}</p>
              <p style="margin:0;font-size:11px;color:${COLORS.border};">Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;font-size:14px;color:${COLORS.textMuted};border-bottom:1px solid ${COLORS.border};width:130px;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;font-size:14px;color:${COLORS.text};font-weight:500;border-bottom:1px solid ${COLORS.border};">${value}</td>
  </tr>`;
}

function badge(text: string, color: string, bgColor: string): string {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;color:${color};background:${bgColor};">${text}</span>`;
}

// --- Templates ---

function confirmationClientHtml(data: BookingEmailData): string {
  const paiementBadge = data.statutPaiement === "paye_en_ligne"
    ? badge("Payé en ligne", COLORS.success, "#e8f5ef")
    : badge("À régler sur place", COLORS.primary, COLORS.accentLight);

  return emailLayout(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:600;color:${COLORS.text};">Réservation confirmée</h1>
    <p style="margin:0 0 28px;font-size:15px;color:${COLORS.textMuted};">Bonjour ${data.clientNom}, votre rendez-vous est bien enregistré.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
      ${detailRow("Soin", data.serviceNom)}
      ${detailRow("Date", `<span style="text-transform:capitalize;">${data.date}</span>`)}
      ${detailRow("Heure", data.heure)}
      ${detailRow("Durée", `${data.duree} minutes`)}
      ${detailRow("Montant", formatMontant(data.montant))}
    </table>

    <div style="margin-bottom:24px;">${paiementBadge}</div>

    <div style="background:${COLORS.accentLight};border-radius:8px;padding:16px 20px;border-left:3px solid ${COLORS.accent};">
      <p style="margin:0;font-size:13px;color:${COLORS.primaryDark};">Merci de vous présenter 5 minutes avant l'heure de votre rendez-vous. Pour toute modification ou annulation, contactez-nous par téléphone.</p>
    </div>
  `);
}

function confirmationAdminHtml(data: BookingEmailData): string {
  const paiementBadge = data.statutPaiement === "paye_en_ligne"
    ? badge("Payé en ligne", COLORS.success, "#e8f5ef")
    : badge("À régler sur place", COLORS.primary, COLORS.accentLight);

  return emailLayout(`
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:600;color:${COLORS.text};">Nouvelle réservation</h1>
    <p style="margin:0 0 24px;font-size:14px;color:${COLORS.textMuted};">Un nouveau rendez-vous vient d'être pris sur le site.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
      ${detailRow("Cliente", `${data.clientNom}${data.clientEmail ? ` &middot; ${data.clientEmail}` : ""}`)}
      ${detailRow("Soin", data.serviceNom)}
      ${detailRow("Date", `<span style="text-transform:capitalize;">${data.date}</span>`)}
      ${detailRow("Heure", data.heure)}
      ${detailRow("Durée", `${data.duree} minutes`)}
      ${detailRow("Montant", formatMontant(data.montant))}
    </table>

    <div>${paiementBadge}</div>
  `);
}

function annulationClientHtml(data: BookingEmailData): string {
  return emailLayout(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:600;color:${COLORS.error};">Rendez-vous annulé</h1>
    <p style="margin:0 0 28px;font-size:15px;color:${COLORS.textMuted};">Bonjour ${data.clientNom}, votre rendez-vous a bien été annulé.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
      ${detailRow("Soin", data.serviceNom)}
      ${detailRow("Date", `<span style="text-transform:capitalize;">${data.date}</span>`)}
      ${detailRow("Heure", data.heure)}
    </table>

    <div style="background:${COLORS.accentLight};border-radius:8px;padding:16px 20px;border-left:3px solid ${COLORS.accent};">
      <p style="margin:0;font-size:13px;color:${COLORS.primaryDark};">N'hésitez pas à reprendre rendez-vous quand vous le souhaitez. Nous serons ravis de vous accueillir à nouveau.</p>
    </div>
  `);
}

function annulationAdminHtml(data: BookingEmailData): string {
  return emailLayout(`
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:600;color:${COLORS.error};">Réservation annulée</h1>
    <p style="margin:0 0 24px;font-size:14px;color:${COLORS.textMuted};">Une réservation vient d'être annulée.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${detailRow("Cliente", `${data.clientNom}${data.clientEmail ? ` &middot; ${data.clientEmail}` : ""}`)}
      ${detailRow("Soin", data.serviceNom)}
      ${detailRow("Date", `<span style="text-transform:capitalize;">${data.date}</span>`)}
      ${detailRow("Heure", data.heure)}
    </table>
  `);
}

function modificationClientHtml(data: BookingEmailData): string {
  return emailLayout(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:600;color:${COLORS.text};">Rendez-vous modifié</h1>
    <p style="margin:0 0 28px;font-size:15px;color:${COLORS.textMuted};">Bonjour ${data.clientNom}, votre rendez-vous a été mis à jour. Voici les nouvelles informations :</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
      ${detailRow("Soin", data.serviceNom)}
      ${detailRow("Date", `<span style="text-transform:capitalize;">${data.date}</span>`)}
      ${detailRow("Heure", data.heure)}
      ${detailRow("Durée", `${data.duree} minutes`)}
      ${detailRow("Montant", formatMontant(data.montant))}
    </table>

    <div style="margin-bottom:24px;">${badge(formatStatutPaiement(data.statutPaiement), COLORS.primary, COLORS.accentLight)}</div>

    <div style="background:${COLORS.accentLight};border-radius:8px;padding:16px 20px;border-left:3px solid ${COLORS.accent};">
      <p style="margin:0;font-size:13px;color:${COLORS.primaryDark};">Merci de vous présenter 5 minutes avant l'heure de votre rendez-vous. Pour toute question, contactez-nous par téléphone.</p>
    </div>
  `);
}

function modificationAdminHtml(data: BookingEmailData): string {
  return emailLayout(`
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:600;color:${COLORS.text};">Réservation modifiée</h1>
    <p style="margin:0 0 24px;font-size:14px;color:${COLORS.textMuted};">Une réservation a été modifiée.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${detailRow("Cliente", `${data.clientNom}${data.clientEmail ? ` &middot; ${data.clientEmail}` : ""}`)}
      ${detailRow("Soin", data.serviceNom)}
      ${detailRow("Nouvelle date", `<span style="text-transform:capitalize;">${data.date}</span>`)}
      ${detailRow("Heure", data.heure)}
      ${detailRow("Durée", `${data.duree} minutes`)}
      ${detailRow("Montant", formatMontant(data.montant))}
    </table>
  `);
}

// --- Envoi avec gardes ---

async function markEmailSent(bookingId: string, field: "email_confirmation_sent" | "email_annulation_sent" | "email_modification_sent") {
  await supabaseAdmin.from("bookings").update({ [field]: true }).eq("id", bookingId);
}

async function isEmailAlreadySent(bookingId: string, field: "email_confirmation_sent" | "email_annulation_sent" | "email_modification_sent"): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from("bookings")
      .select(field)
      .eq("id", bookingId)
      .single();
    if (!data) return false;
    return (data as Record<string, unknown>)[field] === true;
  } catch {
    return false;
  }
}

export async function sendBookingConfirmation(
  booking: { id: string; start_at: string; montant: number | null; statut_paiement: string },
  client: { nom: string; email: string | null },
  service: { nom: string; duree_minutes: number }
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  try {
    const alreadySent = await isEmailAlreadySent(booking.id, "email_confirmation_sent");
    if (alreadySent) return;

    const data = buildEmailData(booking, client, service);
    const { dateShort } = formatDate(booking.start_at);

    const promises: Promise<unknown>[] = [];

    if (data.clientEmail) {
      promises.push(
        resend.emails.send({
          from: FROM_EMAIL,
          to: data.clientEmail,
          subject: `Confirmation de votre rendez-vous — ${data.serviceNom} le ${dateShort} à ${data.heure}`,
          html: confirmationClientHtml(data),
        })
      );
    }

    promises.push(
      resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `Nouvelle réservation — ${data.clientNom} — ${data.serviceNom}`,
        html: confirmationAdminHtml(data),
      })
    );

    await Promise.all(promises);
    await markEmailSent(booking.id, "email_confirmation_sent");
  } catch (err) {
    console.error("[emails] Erreur envoi confirmation:", err);
  }
}

export async function sendBookingCancellation(
  booking: { id: string; start_at: string; montant: number | null; statut_paiement: string },
  client: { nom: string; email: string | null },
  service: { nom: string; duree_minutes: number }
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  try {
    const alreadySent = await isEmailAlreadySent(booking.id, "email_annulation_sent");
    if (alreadySent) return;

    const data = buildEmailData(booking, client, service);

    const promises: Promise<unknown>[] = [];

    if (data.clientEmail) {
      promises.push(
        resend.emails.send({
          from: FROM_EMAIL,
          to: data.clientEmail,
          subject: `Rendez-vous annulé — ${data.serviceNom}`,
          html: annulationClientHtml(data),
        })
      );
    }

    promises.push(
      resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `Annulation — ${data.clientNom} — ${data.serviceNom}`,
        html: annulationAdminHtml(data),
      })
    );

    await Promise.all(promises);
    await markEmailSent(booking.id, "email_annulation_sent");
  } catch (err) {
    console.error("[emails] Erreur envoi annulation:", err);
  }
}

export async function sendBookingModification(
  booking: { id: string; start_at: string; montant: number | null; statut_paiement: string },
  client: { nom: string; email: string | null },
  service: { nom: string; duree_minutes: number }
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  try {
    const alreadySent = await isEmailAlreadySent(booking.id, "email_modification_sent");
    if (alreadySent) return;

    const data = buildEmailData(booking, client, service);
    const { dateShort } = formatDate(booking.start_at);

    const promises: Promise<unknown>[] = [];

    if (data.clientEmail) {
      promises.push(
        resend.emails.send({
          from: FROM_EMAIL,
          to: data.clientEmail,
          subject: `Rendez-vous modifié — ${data.serviceNom} le ${dateShort}`,
          html: modificationClientHtml(data),
        })
      );
    }

    promises.push(
      resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `Modification — ${data.clientNom} — ${data.serviceNom}`,
        html: modificationAdminHtml(data),
      })
    );

    await Promise.all(promises);
    await markEmailSent(booking.id, "email_modification_sent");
  } catch (err) {
    console.error("[emails] Erreur envoi modification:", err);
  }
}
