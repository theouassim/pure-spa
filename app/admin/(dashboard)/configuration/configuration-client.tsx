"use client";

import { useState, useEffect } from "react";
import { Save, Check } from "lucide-react";
import type { AdminSettings } from "@/lib/types";
import { HorairesSection } from "./horaires-section";
import { PausesSection } from "./pauses-section";
import { ParametresSection } from "./parametres-section";
import { MembresSection } from "./membres-section";
import { ServicesSection } from "./services-section";
import { CategoriesSection } from "./categories-section";

export function ConfigurationClient() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      setSettings(data.settings ?? null);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        horaires_ouverture: settings.horaires_ouverture,
        pauses: settings.pauses,
        nb_salles: settings.nb_salles,
        delai_min_avant_rdv: settings.delai_min_avant_rdv,
        battement_minutes: settings.battement_minutes,
        telephone_contact: settings.telephone_contact,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur lors de la sauvegarde.");
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-text-muted">Chargement...</p>;
  }

  if (!settings) {
    return <p className="py-8 text-center text-sm text-error">Impossible de charger la configuration.</p>;
  }

  return (
    <div className="space-y-6">
      <HorairesSection
        horaires={settings.horaires_ouverture}
        onChange={(h) => setSettings({ ...settings, horaires_ouverture: h })}
      />

      <PausesSection
        pauses={settings.pauses}
        horaires={settings.horaires_ouverture}
        onChange={(p) => setSettings({ ...settings, pauses: p })}
      />

      <ParametresSection
        settings={settings}
        onChange={(updates) => setSettings({ ...settings, ...updates })}
      />

      <ServicesSection />

      <CategoriesSection />

      <MembresSection />

      {/* Barre de sauvegarde */}
      <div className="sticky bottom-4 flex items-center gap-3 rounded-lg border border-border bg-bg-card p-4 shadow-md">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? (
            "Enregistrement..."
          ) : saved ? (
            <><Check size={16} /> Enregistré</>
          ) : (
            <><Save size={16} /> Enregistrer les modifications</>
          )}
        </button>
        {error && <p className="text-xs text-error">{error}</p>}
        {saved && <p className="text-xs text-success">Configuration mise à jour avec succès.</p>}
      </div>
    </div>
  );
}
