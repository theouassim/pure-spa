"use client";

import { useState } from "react";
import { track } from "@/lib/tracking";
import type { ContactData, ServiceData, SlotData } from "./BookingFunnel";

interface Props {
  service: ServiceData;
  slot: SlotData;
  contact: ContactData;
  onSlotExpired: () => void;
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

export function BookingSummary({ service, slot, contact, onSlotExpired }: Props) {
  const [loading, setLoading] = useState<"online" | "onsite" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePayOnline() {
    setLoading("online");
    setError(null);

    track("payment_initiated", { service_id: service.id, start: slot.start, mode: "online" });

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          start: slot.start,
          end: slot.end,
          contact,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.error === "slot_expired") {
        track("slot_expired", { service_id: service.id, start: slot.start, stage: "checkout" });
        onSlotExpired();
        return;
      }

      if (!res.ok || !data.url) {
        setError("Erreur lors de la création du paiement. Veuillez réessayer.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(null);
    }
  }

  async function handlePayOnsite() {
    setLoading("onsite");
    setError(null);

    track("payment_initiated", { service_id: service.id, start: slot.start, mode: "on_site" });

    try {
      const res = await fetch("/api/book-onsite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          start: slot.start,
          end: slot.end,
          contact,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.error === "slot_expired") {
        track("slot_expired", { service_id: service.id, start: slot.start, stage: "onsite" });
        onSlotExpired();
        return;
      }

      if (!res.ok || !data.success) {
        setError("Erreur lors de la réservation. Veuillez réessayer.");
        return;
      }

      track("booking_confirmed", { service_id: service.id, start: slot.start, mode: "on_site" });
      window.location.href = `/reserver/confirmation?mode=onsite&booking_id=${data.bookingId}`;
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setLoading(null);
    }
  }

  const isLoading = loading !== null;

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

      {error && (
        <div className="mt-4 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={handlePayOnline}
          disabled={isLoading}
          className="w-full rounded-full bg-primary py-3 text-white font-medium transition-colors hover:bg-primary-dark disabled:opacity-60 disabled:cursor-wait"
        >
          {loading === "online" ? "Redirection vers le paiement…" : "Payer en ligne"}
        </button>

        <button
          onClick={handlePayOnsite}
          disabled={isLoading}
          className="w-full rounded-full border border-primary py-3 text-primary font-medium transition-colors hover:bg-accent-light disabled:opacity-60 disabled:cursor-wait"
        >
          {loading === "onsite" ? "Réservation en cours…" : "Régler sur place"}
        </button>
      </div>

      <p className="mt-3 text-xs text-center text-text-muted">
        Paiement en ligne sécurisé par Stripe.
      </p>
    </div>
  );
}
