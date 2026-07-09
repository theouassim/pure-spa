"use client";

import { useState } from "react";
import { Clock, CheckCircle } from "lucide-react";
import type { BookingEnAttente } from "./facturation-client";

interface Props {
  items: BookingEnAttente[];
  loading: boolean;
  onEncaisser: (bookingId: string) => Promise<void>;
}

export function EnAttenteList({ items, loading, onEncaisser }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <p className="text-sm text-text-muted">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Clock size={16} className="text-primary-dark" />
        <h2 className="text-sm font-semibold text-text">
          Paiements en attente
          {items.length > 0 && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {items.length}
            </span>
          )}
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-text-muted">
          Aucun paiement en attente sur cette période.
        </p>
      ) : (
        <div className="divide-y divide-border/50">
          {items.map((item) => (
            <EnAttenteRow key={item.id} item={item} onEncaisser={onEncaisser} />
          ))}
        </div>
      )}
    </div>
  );
}

function EnAttenteRow({
  item,
  onEncaisser,
}: {
  item: BookingEnAttente;
  onEncaisser: (bookingId: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);

  const startDate = new Date(item.start_at);
  const endDate = new Date(item.end_at);

  const dateStr = startDate.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  });
  const timeStr = `${startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })} – ${endDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}`;

  async function handleConfirm() {
    setProcessing(true);
    await onEncaisser(item.id);
    setProcessing(false);
    setConfirming(false);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">
            {item.service_nom ?? "Service"}
          </span>
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs text-text-muted">{dateStr} {timeStr}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
          <span>{item.client_nom ?? "Client inconnu"}</span>
          {item.client_telephone && (
            <>
              <span>·</span>
              <span>{item.client_telephone}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-text">
          {item.montant != null ? formatEuros(item.montant) : "—"}
        </span>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-1.5 rounded-md border border-success/30 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/5"
          >
            <CheckCircle size={13} />
            Encaisser
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleConfirm}
              disabled={processing}
              className="rounded-md bg-success px-3 py-1.5 text-xs font-medium text-white hover:bg-success/80 disabled:opacity-50"
            >
              {processing ? "..." : "Confirmer"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md border border-border px-2 py-1.5 text-xs text-text-muted hover:bg-accent-light"
            >
              Non
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatEuros(centimes: number): string {
  if (centimes === 0) return "0,00 €";
  return `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
}
