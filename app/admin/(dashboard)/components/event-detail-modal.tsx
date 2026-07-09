"use client";

import { X, User, Phone, Mail, Clock, CreditCard } from "lucide-react";
import type { CalendarEvent } from "@/app/api/admin/events/route";

interface EventDetailPanelProps {
  event: CalendarEvent;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailPanelProps) {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

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
              {event.serviceNom ?? "Rendez-vous"}
            </h3>
            <p className="mt-0.5 text-sm capitalize text-text-muted">{dateStr}</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-accent-light">
            <X size={18} />
          </button>
        </div>

        {/* Horaire */}
        <Section>
          <SectionTitle icon={Clock} label="Horaire" />
          <p className="text-sm text-text">
            {startTime} – {endTime}
            {event.serviceDuree && (
              <span className="ml-2 text-text-muted">({event.serviceDuree} min)</span>
            )}
          </p>
        </Section>

        {/* Client */}
        <Section>
          <SectionTitle icon={User} label="Client" />
          <p className="text-sm font-medium text-text">
            {event.clientNom ?? "Non renseigné"}
          </p>
          {event.clientTelephone ? (
            <a href={`tel:${event.clientTelephone}`} className="mt-1 flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Phone size={13} />
              {event.clientTelephone}
            </a>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
              <Phone size={13} />
              Non renseigné
            </p>
          )}
          {event.clientEmail ? (
            <a href={`mailto:${event.clientEmail}`} className="mt-1 flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Mail size={13} />
              {event.clientEmail}
            </a>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
              <Mail size={13} />
              Non renseigné
            </p>
          )}
        </Section>

        {/* Montant */}
        <Section>
          <SectionTitle icon={CreditCard} label="Paiement" />
          <p className="text-sm text-text">
            {event.montant != null
              ? `${(event.montant / 100).toFixed(2).replace(".", ",")} €`
              : "Non renseigné"}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {formatStatutPaiement(event.statutPaiement, event.stripePaymentId)}
          </p>
        </Section>

        {/* Statut RDV */}
        <Section>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">Statut</span>
            <StatusBadge statut={event.statut} />
          </div>
        </Section>
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

function StatusBadge({ statut }: { statut?: string }) {
  if (statut === "confirmed") {
    return (
      <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
        Confirmé
      </span>
    );
  }
  if (statut === "cancelled") {
    return (
      <span className="rounded-full bg-error/10 px-2.5 py-0.5 text-xs font-medium text-error">
        Annulé
      </span>
    );
  }
  if (statut === "pending") {
    return (
      <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-primary">
        En attente
      </span>
    );
  }
  return null;
}

function formatStatutPaiement(statut?: string, stripeId?: string | null): string {
  switch (statut) {
    case "paye_en_ligne":
      return stripeId ? "Réglé par carte" : "Payé en ligne";
    case "paye_sur_place":
      return "Payé sur place";
    case "en_attente":
      return "En attente de paiement";
    default:
      return "Non renseigné";
  }
}
