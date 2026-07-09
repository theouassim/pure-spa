"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Filter, Search } from "lucide-react";
import type { AdminSettings, Service } from "@/lib/types";
import { BookingsList } from "./bookings-list";
import { CreateBookingModal } from "./create-booking-modal";
import { EditBookingPanel } from "./edit-booking-panel";

export interface BookingRow {
  id: string;
  start_at: string;
  end_at: string;
  statut: string;
  montant: number | null;
  statut_paiement: string;
  stripe_payment_id: string | null;
  service: { id: string; nom: string; duree_minutes: number } | null;
  client: { id: string; nom: string; email: string; telephone: string | null } | null;
}

interface Props {
  services: Pick<Service, "id" | "nom" | "duree_minutes" | "prix">[];
  settings: AdminSettings | null;
}

export function ReservationsClient({ services, settings }: Props) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);

  // Filters
  const [filterStatut, setFilterStatut] = useState<string>("");
  const [filterPaiement, setFilterPaiement] = useState<string>("");
  const [filterService, setFilterService] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatut) params.set("statut", filterStatut);
    if (filterPaiement) params.set("statut_paiement", filterPaiement);
    if (filterService) params.set("service_id", filterService);

    const res = await fetch(`/api/admin/bookings?${params.toString()}`);
    const data = await res.json();
    setBookings(data.bookings ?? []);
    setLoading(false);
  }, [filterStatut, filterPaiement, filterService]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const filteredBookings = searchQuery
    ? bookings.filter((b) => {
        const q = searchQuery.toLowerCase();
        return (
          b.client?.nom?.toLowerCase().includes(q) ||
          b.service?.nom?.toLowerCase().includes(q)
        );
      })
    : bookings;

  return (
    <div className="space-y-4">
      {/* Header: actions + filtres */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          <Plus size={16} />
          Nouveau RDV
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2 text-text-muted" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-md border border-border bg-bg-card py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          <Filter size={14} className="text-text-muted" />
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs"
          >
            <option value="">Tous statuts</option>
            <option value="confirmed">Confirmé</option>
            <option value="cancelled">Annulé</option>
          </select>
          <select
            value={filterPaiement}
            onChange={(e) => setFilterPaiement(e.target.value)}
            className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs"
          >
            <option value="">Tous paiements</option>
            <option value="paye_en_ligne">Payé en ligne</option>
            <option value="paye_sur_place">Payé sur place</option>
            <option value="en_attente">En attente</option>
          </select>
          <select
            value={filterService}
            onChange={(e) => setFilterService(e.target.value)}
            className="rounded-md border border-border bg-bg-card px-2 py-1.5 text-xs"
          >
            <option value="">Tous services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.nom}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste */}
      <BookingsList
        bookings={filteredBookings}
        loading={loading}
        onSelect={setSelectedBooking}
      />

      {/* Modale création */}
      {showCreate && (
        <CreateBookingModal
          services={services}
          settings={settings}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchBookings();
          }}
        />
      )}

      {/* Panneau édition */}
      {selectedBooking && (
        <EditBookingPanel
          booking={selectedBooking}
          services={services}
          onClose={() => setSelectedBooking(null)}
          onUpdated={() => {
            setSelectedBooking(null);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
}
