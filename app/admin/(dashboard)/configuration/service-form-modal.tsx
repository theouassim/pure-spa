"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { InfoTooltip } from "../components/info-tooltip";
import type { ServiceRow } from "./services-section";

interface Props {
  service: ServiceRow | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}

export function ServiceFormModal({ service, categories, onClose, onSaved }: Props) {
  const isEdit = !!service;
  const [nom, setNom] = useState(service?.nom ?? "");
  const [categorie, setCategorie] = useState(service?.categorie ?? "Soins");
  const [newCategorie, setNewCategorie] = useState("");
  const [dureeMinutes, setDureeMinutes] = useState(String(service?.duree_minutes ?? 60));
  const [prixEuros, setPrixEuros] = useState(service ? (service.prix / 100).toFixed(2) : "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [reservableEnLigne, setReservableEnLigne] = useState(service?.reservable_en_ligne ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const duree = parseInt(dureeMinutes, 10);
    if (!nom.trim()) { setError("Nom obligatoire."); return; }
    if (!duree || duree <= 0) { setError("Durée invalide."); return; }
    const prixCentimes = Math.round(parseFloat(prixEuros.replace(",", ".")) * 100);
    if (isNaN(prixCentimes) || prixCentimes < 0) { setError("Prix invalide."); return; }

    const finalCategorie = newCategorie.trim() || categorie;

    setSubmitting(true);

    const payload = {
      nom: nom.trim(),
      categorie: finalCategorie,
      duree_minutes: duree,
      prix: prixCentimes,
      description: description.trim() || null,
      reservable_en_ligne: reservableEnLigne,
    };

    const url = isEdit ? `/api/admin/services/${service.id}` : "/api/admin/services";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur.");
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg bg-bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text">
            {isEdit ? "Modifier le service" : "Nouveau service"}
          </h3>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-accent-light">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Nom */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Nom *</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              required
            />
          </div>

          {/* Catégorie */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Catégorie</label>
            <select
              value={newCategorie ? "__new__" : categorie}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  setNewCategorie(categorie || "");
                } else {
                  setCategorie(e.target.value);
                  setNewCategorie("");
                }
              }}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__new__">+ Nouvelle catégorie</option>
            </select>
            {newCategorie !== "" && (
              <input
                type="text"
                value={newCategorie}
                onChange={(e) => setNewCategorie(e.target.value)}
                placeholder="Nom de la nouvelle catégorie"
                className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm"
              />
            )}
          </div>

          {/* Durée + Prix */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Durée (minutes) *</label>
              <input
                type="number"
                min={1}
                value={dureeMinutes}
                onChange={(e) => setDureeMinutes(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Prix (€) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={prixEuros}
                onChange={(e) => setPrixEuros(e.target.value)}
                placeholder="45,00"
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Description (optionnelle)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>

          {/* Réservable en ligne */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="reservable"
              checked={reservableEnLigne}
              onChange={(e) => setReservableEnLigne(e.target.checked)}
              className="mt-0.5"
            />
            <label htmlFor="reservable" className="text-xs text-text-muted">
              <span className="font-medium text-text">Réservable en ligne</span>
              <InfoTooltip text="Si décoché, les clientes verront 'Réservation par téléphone' dans le tunnel." />
            </label>
          </div>

          {error && <p className="text-xs text-error">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {submitting ? "Enregistrement..." : isEdit ? "Enregistrer" : "Créer le service"}
          </button>
        </form>
      </div>
    </div>
  );
}
