"use client";

import { BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TopService } from "./analytics-client";

interface Props {
  services: TopService[];
  loading: boolean;
}

export function TopServicesChart({ services, loading }: Props) {
  const chartData = services.map((s) => ({
    nom: s.service_nom,
    selections: s.selections,
  }));

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-text">Top services sélectionnés</h2>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-text-muted">Chargement...</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-text-muted">Aucune donnée sur cette période.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 40)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e0db)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--color-text-muted, #8b7e74)" }}
            />
            <YAxis
              type="category"
              dataKey="nom"
              tick={{ fontSize: 11, fill: "var(--color-text-muted, #8b7e74)" }}
              width={140}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-bg-card, #fff)",
                border: "1px solid var(--color-border, #e5e0db)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [`${value} sessions`]}
            />
            <Bar dataKey="selections" fill="#6b4c3b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
