"use client";

import { useState, useEffect } from "react";
import { Layers, GripVertical, Save, Check } from "lucide-react";

interface CategoryRow {
  nom: string;
  ouverte_par_defaut: boolean;
  position: number;
}

export function CategoriesSection() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setLoading(true);
    const res = await fetch("/api/admin/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
    setLoading(false);
  }

  function toggleOpen(nom: string) {
    setCategories((prev) =>
      prev.map((c) => (c.nom === nom ? { ...c, ouverte_par_defaut: !c.ouverte_par_defaut } : c))
    );
    setSaved(false);
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    setCategories((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((c, i) => ({ ...c, position: i }));
    });
    setSaved(false);
  }

  function moveDown(idx: number) {
    if (idx === categories.length - 1) return;
    setCategories((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((c, i) => ({ ...c, position: i }));
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: categories.map((c, i) => ({ ...c, position: i })) }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <p className="text-sm text-text-muted">Chargement des catégories...</p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Layers size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-text">Catégories (affichage tunnel)</h2>
        </div>
        <p className="text-xs text-text-muted">
          Les catégories apparaîtront ici une fois que vous aurez créé des services.
          Exécutez la migration 022 pour initialiser la table.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-text">Catégories (affichage tunnel)</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "..." : saved ? <><Check size={12} /> OK</> : <><Save size={12} /> Sauver</>}
        </button>
      </div>

      <p className="text-xs text-text-muted mb-3">
        Ordre et état par défaut (ouvert/fermé) des catégories dans le tunnel de réservation client.
      </p>

      <div className="space-y-1">
        {categories.map((cat, idx) => (
          <div
            key={cat.nom}
            className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2"
          >
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                className="text-text-muted hover:text-text disabled:opacity-20"
              >
                <GripVertical size={10} className="rotate-180" />
              </button>
              <button
                onClick={() => moveDown(idx)}
                disabled={idx === categories.length - 1}
                className="text-text-muted hover:text-text disabled:opacity-20"
              >
                <GripVertical size={10} />
              </button>
            </div>

            <span className="flex-1 text-sm text-text">{cat.nom}</span>

            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={cat.ouverte_par_defaut}
                onChange={() => toggleOpen(cat.nom)}
                className="h-3.5 w-3.5 rounded border-border text-primary"
              />
              Ouverte
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
