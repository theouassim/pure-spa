"use client";

import type { BookingRow } from "./reservations-client";

interface Props {
  bookings: BookingRow[];
  loading: boolean;
  onSelect: (booking: BookingRow) => void;
}

export function BookingsList({ bookings, loading, onSelect }: Props) {
  if (loading) {
    return <p className="py-8 text-center text-sm text-text-muted">Chargement...</p>;
  }

  if (bookings.length === 0) {
    return <p className="py-8 text-center text-sm text-text-muted">Aucune réservation trouvée.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-bg-card">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-medium text-text-muted">
            <th className="px-4 py-3">Date &amp; créneau</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3">Montant</th>
            <th className="px-4 py-3">Paiement</th>
            <th className="px-4 py-3">Statut</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr
              key={b.id}
              onClick={() => onSelect(b)}
              className="cursor-pointer border-b border-border/50 transition-colors last:border-b-0 hover:bg-accent-light/30"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-text">{formatDate(b.start_at)}</div>
                <div className="text-xs text-text-muted">{formatTimeRange(b.start_at, b.end_at)}</div>
              </td>
              <td className="px-4 py-3 text-text">
                {b.client?.nom ?? "Non renseigné"}
              </td>
              <td className="px-4 py-3 text-text">
                {b.service?.nom ?? "Non renseigné"}
              </td>
              <td className="px-4 py-3 text-text">
                {b.montant != null ? formatEuros(b.montant) : "—"}
              </td>
              <td className="px-4 py-3">
                <PaiementBadge statut={b.statut_paiement} />
              </td>
              <td className="px-4 py-3">
                <StatutBadge statut={b.statut} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaiementBadge({ statut }: { statut: string }) {
  switch (statut) {
    case "paye_en_ligne":
      return <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Payé en ligne</span>;
    case "paye_sur_place":
      return <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Payé sur place</span>;
    case "en_attente":
      return <span className="rounded-full bg-accent/30 px-2 py-0.5 text-xs font-medium text-primary-dark">En attente</span>;
    default:
      return <span className="text-xs text-text-muted">—</span>;
  }
}

function StatutBadge({ statut }: { statut: string }) {
  if (statut === "confirmed") {
    return <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Confirmé</span>;
  }
  if (statut === "cancelled") {
    return <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">Annulé</span>;
  }
  return <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-primary">En attente</span>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  });
}

function formatTimeRange(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" };
  const start = new Date(startIso).toLocaleTimeString("fr-FR", opts);
  const end = new Date(endIso).toLocaleTimeString("fr-FR", opts);
  return `${start} – ${end}`;
}

function formatEuros(centimes: number): string {
  return `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
}
