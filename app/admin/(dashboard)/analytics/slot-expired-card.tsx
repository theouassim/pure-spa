"use client";

import { AlertCircle } from "lucide-react";
import type { SlotExpiredRow } from "./analytics-client";
import { STEP_LABELS } from "./analytics-client";

interface Props {
  data: SlotExpiredRow[];
  totalExpired: number;
  loading: boolean;
}

export function SlotExpiredCard({ data, totalExpired, loading }: Props) {
  if (loading) {
    return <div className="h-32 animate-pulse rounded-lg border border-border bg-bg-card" />;
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertCircle size={16} className="text-primary-dark" />
        <h2 className="text-sm font-semibold text-text">
          Créneaux expirés (slot_expired)
        </h2>
      </div>

      <p className="text-xs text-text-muted">
        Signal de concurrence : le créneau a été pris par une autre cliente pendant le tunnel.
        Ce n&apos;est pas un abandon volontaire.
      </p>

      {totalExpired === 0 ? (
        <p className="mt-3 text-sm text-text-muted">Aucun créneau expiré sur cette période.</p>
      ) : (
        <div className="mt-3">
          <p className="text-lg font-bold text-text">
            {totalExpired} session{totalExpired > 1 ? "s" : ""} impactée{totalExpired > 1 ? "s" : ""}
          </p>
          <div className="mt-2 space-y-1">
            <p className="text-xs font-medium text-text-muted">Étape au moment de l&apos;expiration :</p>
            {data.map((row) => (
              <div key={row.last_step_before} className="flex items-center justify-between rounded bg-accent-light/30 px-3 py-1.5 text-xs">
                <span className="text-text">{STEP_LABELS[row.last_step_before] ?? row.last_step_before}</span>
                <span className="font-semibold text-text">{row.count_at_step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
