"use client";

import { useState, useEffect } from "react";
import { Sparkles, Plus, Pencil, Archive, RotateCcw, Clock, Tag, Filter } from "lucide-react";
import { InfoTooltip } from "../components/info-tooltip";
import { ServiceFormModal } from "./service-form-modal";

export interface ServiceRow {
  id: string;
  nom: string;
  categorie: string;
  duree_minutes: number;
  prix: number;
  description: string | null;
  actif: boolean;
  reservable_en_ligne: boolean;
  battement_min: number | null;
  created_at: string;
}

export function ServicesSection() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [filterCategorie, setFilterCategorie] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchServices() {
    setLoading(true);
    const res = await fetch(`/api/admin/services?all=${showArchived}`);
    const data = await res.json();
    setServices(data.services ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchServices();
  }, [showArchived]);

  const categories = [...new Set(services.map((s) => s.categorie))].sort();

  const filtered = filterCategorie
    ? services.filter((s) => s.categorie === filterCategorie)
    : services;

  const grouped = filtered.reduce<Record<string, ServiceRow[]>>((acc, s) => {
    if (!acc[s.categorie]) acc[s.categorie] = [];
    acc[s.categorie].push(s);
    return acc;
  }, {});

  async function handleArchive(id: string, actif: boolean) {
    setError(null);
    const res = await fetch(`/api/admin/services/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }
    fetchServices();
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-text">Catalogue des services</h2>
        </div>
        <button
          onClick={() => { setEditingService(null); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
        >
          <Plus size={13} />
          Nouveau service
        </button>
      </div>

      {/* Filtres */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Filter size={13} className="text-text-muted" />
        <select
          value={filterCategorie}
          onChange={(e) => setFilterCategorie(e.target.value)}
          className="rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Afficher les archivés
        </label>
      </div>

      {error && <p className="mb-3 text-xs text-error">{error}</p>}

      {loading ? (
        <p className="py-4 text-center text-sm text-text-muted">Chargement...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="py-4 text-center text-sm text-text-muted">Aucun service trouvé.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([categorie, catServices]) => (
            <div key={categorie}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{categorie}</h3>
              <div className="space-y-1">
                {catServices.map((s) => (
                  <ServiceItem
                    key={s.id}
                    service={s}
                    onEdit={() => { setEditingService(s); setShowForm(true); }}
                    onArchive={() => handleArchive(s.id, !s.actif)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ServiceFormModal
          service={editingService}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchServices(); }}
        />
      )}
    </div>
  );
}

function ServiceItem({
  service,
  onEdit,
  onArchive,
}: {
  service: ServiceRow;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <div className={`flex items-center justify-between rounded-md border px-3 py-2.5 ${
      service.actif ? "border-border/50" : "border-border/30 opacity-50"
    }`}>
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text">{service.nom}</span>
            {!service.actif && (
              <span className="rounded bg-accent-light px-1.5 py-0.5 text-[10px] text-text-muted">Archivé</span>
            )}
            {!service.reservable_en_ligne && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary-dark">Tél. uniquement</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1"><Clock size={11} />{service.duree_minutes} min</span>
            <span className="flex items-center gap-1"><Tag size={11} />{formatEuros(service.prix)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="rounded p-1.5 text-text-muted hover:bg-accent-light hover:text-text"
          title="Modifier"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onArchive}
          className={`rounded p-1.5 ${
            service.actif
              ? "text-text-muted hover:bg-error/5 hover:text-error"
              : "text-text-muted hover:bg-success/5 hover:text-success"
          }`}
          title={service.actif ? "Archiver" : "Réactiver"}
        >
          {service.actif ? <Archive size={14} /> : <RotateCcw size={14} />}
        </button>
      </div>
    </div>
  );
}

function formatEuros(centimes: number): string {
  return `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
}
