"use client";

import { Clock } from "lucide-react";
import type { HoraireOuverture } from "@/lib/types";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface Props {
  horaires: HoraireOuverture[];
  onChange: (horaires: HoraireOuverture[]) => void;
}

export function HorairesSection({ horaires, onChange }: Props) {
  function getHoraire(jour: number): HoraireOuverture {
    return horaires.find((h) => h.jour === jour) ?? { jour, ouverture: "", fermeture: "" };
  }

  function updateJour(jour: number, field: "ouverture" | "fermeture", value: string) {
    const existing = horaires.filter((h) => h.jour !== jour);
    const current = getHoraire(jour);
    existing.push({ ...current, [field]: value });
    existing.sort((a, b) => a.jour - b.jour);
    onChange(existing);
  }

  function toggleJour(jour: number, open: boolean) {
    const existing = horaires.filter((h) => h.jour !== jour);
    if (open) {
      existing.push({ jour, ouverture: "10:00", fermeture: "19:00" });
    } else {
      existing.push({ jour, ouverture: "", fermeture: "" });
    }
    existing.sort((a, b) => a.jour - b.jour);
    onChange(existing);
  }

  function isOpen(jour: number): boolean {
    const h = getHoraire(jour);
    return !!(h.ouverture && h.fermeture);
  }

  function hasError(jour: number): string | null {
    const h = getHoraire(jour);
    if (h.ouverture && h.fermeture && h.fermeture <= h.ouverture) {
      return "Fermeture avant ouverture";
    }
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Clock size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-text">Horaires d&apos;ouverture</h2>
      </div>

      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7].map((jour) => {
          const open = isOpen(jour);
          const horaire = getHoraire(jour);
          const err = hasError(jour);

          return (
            <div key={jour} className="flex flex-wrap items-center gap-3 rounded-md border border-border/50 px-3 py-2.5">
              <div className="w-24">
                <span className="text-sm font-medium text-text">{JOURS[jour]}</span>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={open}
                  onChange={(e) => toggleJour(jour, e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-text-muted">{open ? "Ouvert" : "Fermé"}</span>
              </label>

              {open && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={horaire.ouverture}
                    onChange={(e) => updateJour(jour, "ouverture", e.target.value)}
                    className="rounded-md border border-border px-2 py-1 text-sm"
                    step="900"
                  />
                  <span className="text-xs text-text-muted">→</span>
                  <input
                    type="time"
                    value={horaire.fermeture}
                    onChange={(e) => updateJour(jour, "fermeture", e.target.value)}
                    className="rounded-md border border-border px-2 py-1 text-sm"
                    step="900"
                  />
                  {err && <span className="text-[11px] text-error">{err}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
