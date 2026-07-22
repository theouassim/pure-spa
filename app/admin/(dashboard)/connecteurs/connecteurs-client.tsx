"use client";

import { useState, useEffect } from "react";
import {
  PlugZap,
  Check,
  X,
  ExternalLink,
  Save,
  Loader2,
} from "lucide-react";

interface Connector {
  id: string;
  connector_type: string;
  connector_id: string;
  enabled: boolean;
  updated_at: string;
}

const CONNECTOR_META: Record<
  string,
  { label: string; description: string; placeholder: string; steps: string[] }
> = {
  ga4: {
    label: "Google Analytics 4",
    description: "Mesurez le trafic et le comportement des visiteurs sur votre site.",
    placeholder: "G-XXXXXXXXXX",
    steps: [
      "Connectez-vous sur analytics.google.com",
      "Cliquez sur Administration (roue dentée en bas à gauche)",
      "Dans la colonne Propriété, cliquez sur Flux de données",
      "Sélectionnez votre flux web",
      "Copiez l'ID de mesure qui commence par G-",
    ],
  },
  gtm: {
    label: "Google Tag Manager",
    description: "Gérez tous vos tags marketing depuis une interface unique.",
    placeholder: "GTM-XXXXXXX",
    steps: [
      "Connectez-vous sur tagmanager.google.com",
      "Sélectionnez votre conteneur",
      "L'ID du conteneur s'affiche en haut (format GTM-XXXXXXX)",
      "Copiez cet identifiant",
    ],
  },
  meta_pixel: {
    label: "Meta Pixel (Facebook)",
    description: "Suivez les conversions et créez des audiences pour vos publicités Meta.",
    placeholder: "1234567890123456",
    steps: [
      "Connectez-vous sur business.facebook.com",
      "Allez dans Gestionnaire d'événements",
      "Sélectionnez votre Pixel (ou créez-en un)",
      "L'ID du Pixel est un nombre à 15-16 chiffres visible en haut",
      "Copiez ce nombre",
    ],
  },
};

export function ConnecteursClient() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [editType, setEditType] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConnectors();
  }, []);

  async function loadConnectors() {
    const res = await fetch("/api/admin/connectors");
    const data = await res.json();
    setConnectors(data.connectors ?? []);
    setLoading(false);
  }

  function openEdit(type: string) {
    const connector = connectors.find((c) => c.connector_type === type);
    setEditValue(connector?.connector_id ?? "");
    setEditType(type);
    setError(null);
    setSuccess(null);
  }

  async function handleSave() {
    if (!editType) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/connectors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connector_type: editType,
        connector_id: editValue.trim(),
        enabled: editValue.trim() !== "",
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setSuccess("Connecteur mis à jour avec succès.");
    setTimeout(() => setSuccess(null), 3000);
    setEditType(null);
    loadConnectors();
  }

  async function toggleEnabled(type: string, currentlyEnabled: boolean) {
    const res = await fetch("/api/admin/connectors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connector_type: type,
        enabled: !currentlyEnabled,
      }),
    });

    if (res.ok) {
      loadConnectors();
    }
  }

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-text-muted">Chargement...</p>
    );
  }

  return (
    <div className="space-y-4">
      {connectors.map((connector) => {
        const meta = CONNECTOR_META[connector.connector_type];
        if (!meta) return null;
        const isConnected = connector.enabled && connector.connector_id !== "";

        return (
          <div
            key={connector.id}
            className="rounded-lg border border-border bg-bg-card p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <PlugZap
                  size={20}
                  className={isConnected ? "text-success mt-0.5" : "text-text-muted mt-0.5"}
                />
                <div>
                  <h3 className="text-sm font-semibold text-text">
                    {meta.label}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {meta.description}
                  </p>
                  {connector.connector_id && (
                    <p className="text-xs font-mono text-text-muted mt-1">
                      ID : {connector.connector_id}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    isConnected
                      ? "bg-success/10 text-success"
                      : "bg-accent-light text-text-muted"
                  }`}
                >
                  {isConnected ? (
                    <>
                      <Check size={12} /> Connecté
                    </>
                  ) : (
                    <>
                      <X size={12} /> Non connecté
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => openEdit(connector.connector_type)}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark transition-colors"
              >
                Configurer
              </button>
              {connector.connector_id && (
                <button
                  onClick={() =>
                    toggleEnabled(connector.connector_type, connector.enabled)
                  }
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    connector.enabled
                      ? "border-error/30 text-error hover:bg-error/5"
                      : "border-success/30 text-success hover:bg-success/5"
                  }`}
                >
                  {connector.enabled ? "Désactiver" : "Activer"}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {editType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-bg-card border border-border p-6 shadow-xl">
            <h3 className="text-base font-semibold text-text mb-1">
              Configurer {CONNECTOR_META[editType].label}
            </h3>
            <p className="text-xs text-text-muted mb-4">
              Suivez les étapes ci-dessous pour trouver votre identifiant.
            </p>

            <div className="rounded-lg bg-bg border border-border p-4 mb-4">
              <p className="text-xs font-medium text-text mb-2 flex items-center gap-1.5">
                <ExternalLink size={12} />
                Comment trouver l&apos;identifiant
              </p>
              <ol className="space-y-1.5">
                {CONNECTOR_META[editType].steps.map((step, i) => (
                  <li key={i} className="text-xs text-text-muted flex gap-2">
                    <span className="text-primary font-semibold shrink-0">
                      {i + 1}.
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <label className="block text-xs font-medium text-text mb-1.5">
              Identifiant
            </label>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={CONNECTOR_META[editType].placeholder}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />

            {error && (
              <p className="mt-2 text-xs text-error">{error}</p>
            )}
            {success && (
              <p className="mt-2 text-xs text-success">{success}</p>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Enregistrer
              </button>
              <button
                onClick={() => setEditType(null)}
                className="rounded-md border border-border px-4 py-2 text-xs font-medium text-text-muted hover:bg-accent-light transition-colors"
              >
                Annuler
              </button>
              {editValue && (
                <button
                  onClick={() => {
                    setEditValue("");
                  }}
                  className="ml-auto text-xs text-error hover:underline"
                >
                  Supprimer l&apos;ID
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
