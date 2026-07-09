"use client";

import { useState } from "react";
import { Settings, AlertTriangle, Phone } from "lucide-react";
import { InfoTooltip } from "../components/info-tooltip";
import type { AdminSettings } from "@/lib/types";

interface Props {
  settings: AdminSettings;
  onChange: (updates: Partial<AdminSettings>) => void;
}

export function ParametresSection({ settings, onChange }: Props) {
  const [nbSallesWarning, setNbSallesWarning] = useState(false);

  function handleNbSallesChange(value: string) {
    const nb = parseInt(value, 10);
    if (isNaN(nb)) return;
    if (nb !== settings.nb_salles) {
      setNbSallesWarning(true);
    } else {
      setNbSallesWarning(false);
    }
    onChange({ nb_salles: nb });
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Settings size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-text">Paramètres de réservation</h2>
      </div>

      <div className="space-y-4">
        {/* Nombre de salles */}
        <div>
          <div className="mb-1 flex items-center gap-1">
            <label className="text-xs font-medium text-text-muted">Nombre de salles (capacité)</label>
            <InfoTooltip text="Nombre de RDV en parallèle. Changer ici impacte toute la disponibilité." />
          </div>
          <input
            type="number"
            min={1}
            max={10}
            value={settings.nb_salles}
            onChange={(e) => handleNbSallesChange(e.target.value)}
            className="w-24 rounded-md border border-border px-3 py-2 text-sm"
          />
          {nbSallesWarning && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-error/30 bg-error/5 p-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" />
              <div>
                <p className="text-xs font-medium text-error">Attention : modification de la capacité</p>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  Ce changement impacte directement le nombre de créneaux disponibles pour les clientes
                  et la détection de surbooking sur le calendrier.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Délai minimum */}
        <div>
          <div className="mb-1 flex items-center gap-1">
            <label className="text-xs font-medium text-text-muted">Délai minimum avant RDV (minutes)</label>
            <InfoTooltip text="Temps minimum entre maintenant et le prochain créneau réservable." />
          </div>
          <input
            type="number"
            min={0}
            max={1440}
            step={15}
            value={settings.delai_min_avant_rdv}
            onChange={(e) => onChange({ delai_min_avant_rdv: parseInt(e.target.value, 10) || 0 })}
            className="w-24 rounded-md border border-border px-3 py-2 text-sm"
          />
          <p className="mt-0.5 text-[11px] text-text-muted">
            {settings.delai_min_avant_rdv >= 60
              ? `${Math.floor(settings.delai_min_avant_rdv / 60)}h${settings.delai_min_avant_rdv % 60 > 0 ? (settings.delai_min_avant_rdv % 60).toString().padStart(2, "0") : ""} avant le RDV`
              : `${settings.delai_min_avant_rdv} min avant le RDV`}
          </p>
        </div>

        {/* Battement */}
        <div>
          <div className="mb-1 flex items-center gap-1">
            <label className="text-xs font-medium text-text-muted">Battement entre RDV (minutes)</label>
            <InfoTooltip text="Temps de nettoyage/préparation entre deux rendez-vous consécutifs." />
          </div>
          <input
            type="number"
            min={0}
            max={120}
            step={5}
            value={settings.battement_minutes}
            onChange={(e) => onChange({ battement_minutes: parseInt(e.target.value, 10) || 0 })}
            className="w-24 rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        {/* Téléphone contact */}
        <div>
          <div className="mb-1 flex items-center gap-1">
            <Phone size={12} className="text-text-muted" />
            <label className="text-xs font-medium text-text-muted">Téléphone de contact</label>
          </div>
          <input
            type="tel"
            value={settings.telephone_contact}
            onChange={(e) => onChange({ telephone_contact: e.target.value })}
            placeholder="06 12 34 56 78"
            className="w-48 rounded-md border border-border px-3 py-2 text-sm"
          />
          <p className="mt-0.5 text-[11px] text-text-muted">
            Affiché aux clientes pour les services non réservables en ligne.
          </p>
        </div>
      </div>
    </div>
  );
}
