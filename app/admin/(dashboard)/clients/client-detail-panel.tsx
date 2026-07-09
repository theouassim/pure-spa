"use client";

import { useState, useEffect } from "react";
import { X, User, Phone, Mail, Calendar, Euro, History, TrendingUp, Clock } from "lucide-react";
import type { ClientRow } from "./clients-client";

interface ClientBooking {
  id: string;
  start_at: string;
  end_at: string;
  statut: string;
  montant: number | null;
  statut_paiement: string;
  service_nom: string | null;
  service_duree_minutes: number | null;
}

interface Props {
  client: ClientRow;
  onClose: () => void;
}

export function ClientDetailPanel({ client, onClose }: Props) {
  const [bookings, setBookings] = useState<ClientBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  useEffect(() => {
    async function fetchBookings() {
      setLoadingBookings(true);
      const res = await fetch(`/api/admin/clients/${client.id}/bookings`);
      const data = await res.json();
      setBookings(data.bookings ?? []);
      setLoadingBookings(false);
    }
    fetchBookings();
  }, [client.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative h-full w-full max-w-md animate-slide-in overflow-y-auto border-l border-border bg-bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text">{client.nom}</h3>
              <p className="text-xs text-text-muted">
                Client depuis {client.created_at ? formatDate(client.created_at) : "Non renseigné"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-accent-light">
            <X size={18} />
          </button>
        </div>

        {/* Coordonnées */}
        <Section>
          <SectionTitle icon={User} label="Coordonnées" />
          <div className="space-y-2">
            {client.telephone ? (
              <a href={`tel:${client.telephone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Phone size={14} />
                {client.telephone}
              </a>
            ) : (
              <p className="flex items-center gap-2 text-sm text-text-muted">
                <Phone size={14} /> Non renseigné
              </p>
            )}
            {client.email ? (
              <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Mail size={14} />
                {client.email}
              </a>
            ) : (
              <p className="flex items-center gap-2 text-sm text-text-muted">
                <Mail size={14} /> Non renseigné
              </p>
            )}
          </div>
        </Section>

        {/* Stats */}
        <Section>
          <SectionTitle icon={TrendingUp} label="Statistiques" />
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Calendar} label="Total RDV" value={String(client.nb_rdv)} />
            <StatCard icon={Euro} label="Total dépensé" value={formatEuros(client.total_depense)} />
            {client.montant_en_attente > 0 && (
              <StatCard icon={Clock} label="En attente" value={formatEuros(client.montant_en_attente)} muted />
            )}
            <StatCard
              icon={Calendar}
              label="Premier RDV"
              value={client.premier_rdv ? formatDate(client.premier_rdv) : "Aucun"}
            />
            <StatCard
              icon={Calendar}
              label="Dernier RDV"
              value={client.dernier_rdv ? formatDate(client.dernier_rdv) : "Aucun"}
            />
          </div>
        </Section>

        {/* Historique */}
        <Section>
          <SectionTitle icon={History} label="Historique des rendez-vous" />
          {loadingBookings ? (
            <p className="py-4 text-center text-xs text-text-muted">Chargement...</p>
          ) : bookings.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted">Aucun rendez-vous.</p>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <BookingHistoryItem key={b.id} booking={b} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function BookingHistoryItem({ booking }: { booking: ClientBooking }) {
  const isCancelled = booking.statut === "cancelled";
  const startDate = new Date(booking.start_at);
  const endDate = new Date(booking.end_at);

  const dateStr = startDate.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const timeStr = `${startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })} – ${endDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}`;

  return (
    <div className={`rounded-md border p-3 ${isCancelled ? "border-border/50 opacity-50" : "border-border"}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-text">
            {booking.service_nom ?? "Service inconnu"}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">{dateStr} · {timeStr}</p>
        </div>
        <div className="text-right">
          {booking.montant != null && (
            <p className="text-sm font-medium text-text">{formatEuros(booking.montant)}</p>
          )}
          <div className="mt-0.5 flex items-center justify-end gap-1.5">
            <PaiementBadge statut={booking.statut_paiement} />
            <StatutBadge statut={booking.statut} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        <Icon size={11} />
        {label}
      </div>
      <p className={`mt-1 text-sm font-semibold ${muted ? "text-text-muted" : "text-text"}`}>
        {value}
      </p>
    </div>
  );
}

function PaiementBadge({ statut }: { statut: string }) {
  switch (statut) {
    case "paye_en_ligne":
      return <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">Payé en ligne</span>;
    case "paye_sur_place":
      return <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Payé sur place</span>;
    case "en_attente":
      return <span className="rounded-full bg-accent/30 px-1.5 py-0.5 text-[10px] font-medium text-primary-dark">En attente</span>;
    default:
      return null;
  }
}

function StatutBadge({ statut }: { statut: string }) {
  if (statut === "cancelled") {
    return <span className="rounded-full bg-error/10 px-1.5 py-0.5 text-[10px] font-medium text-error">Annulé</span>;
  }
  return null;
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 border-t border-border pt-4">{children}</div>;
}

function SectionTitle({ icon: Icon, label }: { icon: React.ComponentType<{ size?: number }>; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
      <Icon size={13} />
      {label}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

function formatEuros(centimes: number): string {
  if (centimes === 0) return "0,00 €";
  return `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
}
