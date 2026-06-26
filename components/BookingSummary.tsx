"use client";

import type { ContactData, ServiceData, SlotData } from "./BookingFunnel";

interface Props {
  service: ServiceData;
  slot: SlotData;
  contact: ContactData;
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export function BookingSummary({ service, slot, contact }: Props) {
  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-text mb-6">Récapitulatif</h2>

      <div className="rounded-lg border border-border bg-bg-card divide-y divide-border">
        <div className="p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Prestation</p>
          <p className="font-medium text-text">{service.nom}</p>
          <p className="text-sm text-text-muted">{service.duree_minutes} min — {formatPrice(service.prix)}</p>
        </div>

        <div className="p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Date & heure</p>
          <p className="font-medium text-text capitalize">{formatDateTime(slot.start)}</p>
          <p className="text-sm text-text-muted">
            {formatTime(slot.start)} — {formatTime(slot.end)}
          </p>
        </div>

        <div className="p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Coordonnées</p>
          <p className="font-medium text-text">{contact.nom}</p>
          <p className="text-sm text-text-muted">{contact.email}</p>
          <p className="text-sm text-text-muted">{contact.telephone}</p>
        </div>

        <div className="p-4">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Total</p>
          <p className="text-xl font-semibold text-primary">{formatPrice(service.prix)}</p>
        </div>
      </div>

      {/* Stripe checkout button will be added in Phase 4 */}
      <div className="mt-6 p-4 rounded-lg bg-accent-light/50 border border-border text-center">
        <p className="text-sm text-text-muted">
          Le paiement en ligne sera disponible prochainement.
        </p>
      </div>
    </div>
  );
}
