"use client";

import { Coffee, Plus, Trash2 } from "lucide-react";
import type { HoraireOuverture, Pause } from "@/lib/types";

interface Props {
  pauses: Pause[];
  horaires: HoraireOuverture[];
  onChange: (pauses: Pause[]) => void;
}

export function PausesSection({ pauses, horaires, onChange }: Props) {
  function addPause() {
    onChange([...pauses, { debut: "12:00", fin: "13:00" }]);
  }

  function removePause(index: number) {
    onChange(pauses.filter((_, i) => i !== index));
  }

  function updatePause(index: number, field: "debut" | "fin", value: string) {
    const updated = pauses.map((p, i) => (i === index ? { ...p, [field]: value } : p));
    onChange(updated);
  }

  function getError(pause: Pause): string | null {
    if (pause.debut >= pause.fin) {
      return "Fin avant début";
    }
    const openDays = horaires.filter((h) => h.ouverture && h.fermeture);
    if (openDays.length > 0) {
      const fits = openDays.some((h) => pause.debut >= h.ouverture && pause.fin <= h.fermeture);
      if (!fits) return "Hors horaires d'ouverture";
    }
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coffee size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-text">Pauses</h2>
        </div>
        <button
          type="button"
          onClick={addPause}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-accent-light"
        >
          <Plus size={13} />
          Ajouter une pause
        </button>
      </div>

      {pauses.length === 0 ? (
        <p className="text-sm text-text-muted">Aucune pause configurée.</p>
      ) : (
        <div className="space-y-2">
          {pauses.map((pause, i) => {
            const err = getError(pause);
            return (
              <div key={i} className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={pause.debut}
                    onChange={(e) => updatePause(i, "debut", e.target.value)}
                    className="rounded-md border border-border px-2 py-1 text-sm"
                    step="900"
                  />
                  <span className="text-xs text-text-muted">→</span>
                  <input
                    type="time"
                    value={pause.fin}
                    onChange={(e) => updatePause(i, "fin", e.target.value)}
                    className="rounded-md border border-border px-2 py-1 text-sm"
                    step="900"
                  />
                </div>
                {err && <span className="text-[11px] text-error">{err}</span>}
                <button
                  type="button"
                  onClick={() => removePause(i)}
                  className="ml-auto rounded p-1.5 text-text-muted hover:bg-error/5 hover:text-error"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
