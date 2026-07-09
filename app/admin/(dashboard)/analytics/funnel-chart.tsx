"use client";

import { Filter, TrendingDown } from "lucide-react";
import { InfoTooltip } from "../components/info-tooltip";

interface FunnelStepData {
  name: string;
  label: string;
  count: number;
}

interface Props {
  steps: FunnelStepData[];
  loading: boolean;
}

const COLORS = ["#6b4c3b", "#7d5d4c", "#8f6e5d", "#a17f6e", "#b3907f", "#c4a882"];

export function FunnelChart({ steps, loading }: Props) {
  const maxCount = steps[0]?.count ?? 1;

  // Plus gros décrochage en volume absolu (pas en %)
  let biggestDrop = { index: -1, count: 0 };
  for (let i = 1; i < steps.length; i++) {
    const drop = steps[i - 1].count - steps[i].count;
    if (drop > biggestDrop.count) {
      biggestDrop = { index: i, count: drop };
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Filter size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-text">Entonnoir de conversion</h2>
        <InfoTooltip text="Progression des clientes étape par étape jusqu'à la réservation." />
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-text-muted">Chargement...</p>
        </div>
      ) : maxCount === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-text-muted">Aucune donnée sur cette période.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {/* En-tête tableau */}
          <div className="grid grid-cols-[1fr_80px_80px_100px] gap-2 border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            <span>Étape</span>
            <span className="text-right">Sessions</span>
            <span className="flex items-center justify-end gap-0.5">Taux<InfoTooltip text="Part des clientes passées à l'étape suivante." size={11} /></span>
            <span className="flex items-center justify-end gap-0.5">Abandons<InfoTooltip text="Nombre de clientes perdues à cette étape." size={11} /></span>
          </div>

          {/* Lignes */}
          {steps.map((step, i) => {
            const prev = i > 0 ? steps[i - 1].count : null;
            const passRate = prev && prev > 0 ? ((step.count / prev) * 100).toFixed(1) : null;
            const abandons = prev != null ? prev - step.count : null;
            const isBiggestDrop = i === biggestDrop.index && biggestDrop.count > 0;
            const barWidth = maxCount > 0 ? (step.count / maxCount) * 100 : 0;

            return (
              <div
                key={step.name}
                className={`relative grid grid-cols-[1fr_80px_80px_100px] items-center gap-2 rounded px-3 py-2.5 ${
                  isBiggestDrop ? "bg-error/5 ring-1 ring-error/20" : ""
                }`}
              >
                {/* Barre de fond proportionnelle */}
                <div
                  className="absolute inset-y-0 left-0 rounded opacity-10"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: COLORS[i % COLORS.length],
                  }}
                />

                {/* Étape */}
                <div className="relative flex items-center gap-2">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-sm font-medium text-text">{step.label}</span>
                </div>

                {/* Sessions */}
                <span className="relative text-right text-sm font-semibold text-text">
                  {step.count}
                </span>

                {/* Taux de passage */}
                <span className={`relative text-right text-xs ${isBiggestDrop ? "font-bold text-error" : "text-text-muted"}`}>
                  {passRate ? `${passRate} %` : "—"}
                </span>

                {/* Abandons absolus */}
                <div className="relative flex items-center justify-end gap-1">
                  {abandons != null && abandons > 0 ? (
                    <>
                      <TrendingDown size={12} className={isBiggestDrop ? "text-error" : "text-text-muted"} />
                      <span className={`text-sm font-semibold ${isBiggestDrop ? "text-error" : "text-text-muted"}`}>
                        {abandons}
                      </span>
                      {isBiggestDrop && (
                        <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-error/10 px-1.5 py-0.5 text-[10px] font-bold text-error">
                          MAX
                          <InfoTooltip text="L'étape où vous perdez le plus de clientes." size={10} />
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
