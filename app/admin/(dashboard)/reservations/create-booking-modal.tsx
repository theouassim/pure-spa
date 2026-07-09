"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, UserPlus, Search } from "lucide-react";
import type { AdminSettings, Service } from "@/lib/types";

interface Props {
  services: Pick<Service, "id" | "nom" | "duree_minutes" | "prix">[];
  settings: AdminSettings | null;
  onClose: () => void;
  onCreated: () => void;
}

interface ClientOption {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
}

export function CreateBookingModal({ services, settings, onClose, onCreated }: Props) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [allowOverride, setAllowOverride] = useState(false);
  const [statutPaiement, setStatutPaiement] = useState<"en_attente" | "paye_sur_place">("en_attente");

  // Client search
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [clientNom, setClientNom] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search clients
  useEffect(() => {
    if (clientSearch.length < 2) {
      setClientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/admin/clients?q=${encodeURIComponent(clientSearch)}`);
      const data = await res.json();
      setClientResults(data.clients ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const selectedService = services.find((s) => s.id === serviceId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!serviceId || !date || !time) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (!selectedClient && !clientNom) {
      setError("Veuillez sélectionner ou créer un client.");
      return;
    }

    const durationMin = selectedService?.duree_minutes ?? 60;
    const startDate = new Date(`${date}T${time}:00`);
    const tzOffset = getParisOffset(startDate);
    const startUtc = new Date(startDate.getTime() - tzOffset);
    const endUtc = new Date(startUtc.getTime() + durationMin * 60_000);

    setSubmitting(true);

    const payload = {
      serviceId,
      start: startUtc.toISOString(),
      end: endUtc.toISOString(),
      allowOverride,
      statutPaiement,
      client: selectedClient
        ? { id: selectedClient.id, nom: selectedClient.nom }
        : { nom: clientNom, email: clientEmail || null, telephone: clientTelephone || null },
    };

    const res = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.message ?? data.error ?? "Erreur lors de la création.");
      return;
    }

    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text">Nouveau rendez-vous</h3>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-accent-light">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Service */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Service</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom} ({s.duree_minutes} min)
                </option>
              ))}
            </select>
          </div>

          {/* Date + heure */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Heure (Paris)</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                step="900"
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          {/* Client */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Client</label>
            {!selectedClient && !newClient && (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, email ou tél..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full rounded-md border border-border py-2 pl-8 pr-3 text-sm"
                  />
                </div>
                {clientResults.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-bg">
                    {clientResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedClient(c); setClientSearch(""); }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent-light"
                      >
                        <span className="font-medium">{c.nom}</span>
                        <span className="text-xs text-text-muted">{c.telephone ?? c.email}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setNewClient(true)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <UserPlus size={13} />
                  Créer un nouveau client
                </button>
              </div>
            )}
            {selectedClient && (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span className="text-sm font-medium">{selectedClient.nom}</span>
                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  className="text-xs text-text-muted hover:text-error"
                >
                  Changer
                </button>
              </div>
            )}
            {newClient && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <input
                  type="text"
                  placeholder="Nom *"
                  value={clientNom}
                  onChange={(e) => setClientNom(e.target.value)}
                  className="w-full rounded border border-border px-3 py-1.5 text-sm"
                  required
                />
                <input
                  type="tel"
                  placeholder="Téléphone"
                  value={clientTelephone}
                  onChange={(e) => setClientTelephone(e.target.value)}
                  className="w-full rounded border border-border px-3 py-1.5 text-sm"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded border border-border px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => { setNewClient(false); setClientNom(""); setClientEmail(""); setClientTelephone(""); }}
                  className="text-xs text-text-muted hover:underline"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>

          {/* Statut paiement */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Paiement</label>
            <select
              value={statutPaiement}
              onChange={(e) => setStatutPaiement(e.target.value as "en_attente" | "paye_sur_place")}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="en_attente">En attente</option>
              <option value="paye_sur_place">Payé sur place</option>
            </select>
          </div>

          {/* Override */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="override"
              checked={allowOverride}
              onChange={(e) => setAllowOverride(e.target.checked)}
              className="mt-0.5"
            />
            <label htmlFor="override" className="text-xs text-text-muted">
              <span className="flex items-center gap-1 font-medium text-primary-dark">
                <AlertTriangle size={12} />
                Forcer ce créneau (surbooking assumé)
              </span>
              {allowOverride && (
                <span className="mt-0.5 block text-[11px] text-error/80">
                  Ce RDV dépassera la capacité et apparaîtra en alerte sur le calendrier.
                </span>
              )}
            </label>
          </div>

          {error && <p className="text-xs text-error">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {submitting ? "Création..." : "Créer le rendez-vous"}
          </button>
        </form>
      </div>
    </div>
  );
}

function getParisOffset(date: Date): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const parisStr = date.toLocaleString("en-US", { timeZone: "Europe/Paris" });
  return new Date(parisStr).getTime() - new Date(utcStr).getTime();
}
