"use client";

import { useState } from "react";
import { X, Clock, User, Phone, Mail, CreditCard, AlertTriangle, Trash2 } from "lucide-react";
import type { Service } from "@/lib/types";
import type { BookingRow } from "./reservations-client";

interface Props {
  booking: BookingRow;
  services: Pick<Service, "id" | "nom" | "duree_minutes" | "prix">[];
  onClose: () => void;
  onUpdated: () => void;
}

export function EditBookingPanel({ booking, services, onClose, onUpdated }: Props) {
  const [statutPaiement, setStatutPaiement] = useState(booking.statut_paiement);
  const [serviceId, setServiceId] = useState(booking.service?.id ?? "");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = new Date(booking.start_at);
  const endDate = new Date(booking.end_at);

  const dateStr = startDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const startTime = startDate.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
  const endTime = endDate.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  const isCancelled = booking.statut === "cancelled";

  async function handleSave() {
    setSaving(true);
    setError(null);

    const updates: Record<string, string> = {};
    if (statutPaiement !== booking.statut_paiement) updates.statut_paiement = statutPaiement;
    if (serviceId !== booking.service?.id) updates.service_id = serviceId;

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    const res = await fetch(`/api/admin/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Erreur lors de la modification.");
      return;
    }
    onUpdated();
  }

  async function handleCancel() {
    setSaving(true);
    const res = await fetch(`/api/admin/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "cancelled" }),
    });
    setSaving(false);
    if (res.ok) {
      onUpdated();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative h-full w-full max-w-sm animate-slide-in overflow-y-auto border-l border-border bg-bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-text">
              {booking.service?.nom ?? "Rendez-vous"}
            </h3>
            <p className="mt-0.5 text-sm capitalize text-text-muted">{dateStr}</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-accent-light">
            <X size={18} />
          </button>
        </div>

        {/* Statut */}
        <div className="mt-3">
          {isCancelled ? (
            <span className="rounded-full bg-error/10 px-2.5 py-0.5 text-xs font-medium text-error">Annulé</span>
          ) : (
            <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">Confirmé</span>
          )}
        </div>

        {/* Horaire */}
        <Section>
          <SectionTitle icon={Clock} label="Horaire" />
          <p className="text-sm text-text">
            {startTime} – {endTime}
            {booking.service?.duree_minutes && (
              <span className="ml-2 text-text-muted">({booking.service.duree_minutes} min)</span>
            )}
          </p>
        </Section>

        {/* Client */}
        <Section>
          <SectionTitle icon={User} label="Client" />
          <p className="text-sm font-medium text-text">
            {booking.client?.nom ?? "Non renseigné"}
          </p>
          {booking.client?.telephone ? (
            <a href={`tel:${booking.client.telephone}`} className="mt-1 flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Phone size={13} />
              {booking.client.telephone}
            </a>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
              <Phone size={13} /> Non renseigné
            </p>
          )}
          {booking.client?.email ? (
            <a href={`mailto:${booking.client.email}`} className="mt-1 flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Mail size={13} />
              {booking.client.email}
            </a>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
              <Mail size={13} /> Non renseigné
            </p>
          )}
        </Section>

        {/* Paiement — éditable */}
        <Section>
          <SectionTitle icon={CreditCard} label="Paiement" />
          <p className="mb-2 text-sm text-text">
            {booking.montant != null
              ? `${(booking.montant / 100).toFixed(2).replace(".", ",")} €`
              : "Non renseigné"}
          </p>
          {!isCancelled && (
            <select
              value={statutPaiement}
              onChange={(e) => setStatutPaiement(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-1.5 text-sm"
            >
              <option value="en_attente">En attente de paiement</option>
              <option value="paye_sur_place">Payé sur place</option>
              <option value="paye_en_ligne">Payé en ligne</option>
            </select>
          )}
          {isCancelled && (
            <p className="text-sm text-text-muted">{formatPaiement(booking.statut_paiement, booking.stripe_payment_id)}</p>
          )}
        </Section>

        {/* Service — éditable */}
        {!isCancelled && (
          <Section>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-text-muted">Service</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-1.5 text-sm"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.nom} ({s.duree_minutes} min)</option>
              ))}
            </select>
          </Section>
        )}

        {error && <p className="mt-3 text-xs text-error">{error}</p>}

        {/* Actions */}
        {!isCancelled && (
          <div className="mt-6 space-y-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-md bg-primary py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-error/30 py-2 text-sm font-medium text-error hover:bg-error/5"
            >
              <Trash2 size={14} />
              Annuler ce RDV
            </button>
          </div>
        )}

        {/* Confirmation annulation */}
        {showCancelConfirm && (
          <div className="mt-4 rounded-md border border-error/30 bg-error/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-error">
              <AlertTriangle size={16} />
              Confirmer l&apos;annulation ?
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Le rendez-vous sera marqué comme annulé. Cette action est irréversible.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="rounded-md bg-error px-4 py-1.5 text-xs font-medium text-white hover:bg-error/80 disabled:opacity-50"
              >
                Confirmer
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="rounded-md border border-border px-4 py-1.5 text-xs text-text-muted hover:bg-accent-light"
              >
                Garder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 border-t border-border pt-4">{children}</div>;
}

function SectionTitle({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number }>; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
      <Icon size={13} />
      {label}
    </div>
  );
}

function formatPaiement(statut: string, stripeId: string | null): string {
  switch (statut) {
    case "paye_en_ligne": return stripeId ? "Réglé par carte" : "Payé en ligne";
    case "paye_sur_place": return "Payé sur place";
    case "en_attente": return "En attente de paiement";
    default: return "Non renseigné";
  }
}
