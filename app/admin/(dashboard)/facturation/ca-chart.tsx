"use client";

import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ChartPoint } from "./facturation-client";

interface Props {
  data: ChartPoint[];
  loading: boolean;
}

export function CaChart({ data, loading }: Props) {
  const chartData = data.map((d) => ({
    semaine: formatWeekLabel(d.semaine_debut),
    "En ligne": d.ca_en_ligne / 100,
    "Sur place": d.ca_sur_place / 100,
  }));

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-text">CA par semaine</h2>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-text-muted">Chargement...</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-text-muted">Aucune donnée sur cette période.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e0db)" />
            <XAxis
              dataKey="semaine"
              tick={{ fontSize: 11, fill: "var(--color-text-muted, #8b7e74)" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-text-muted, #8b7e74)" }}
              tickFormatter={(v: number) => `${v} €`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-bg-card, #fff)",
                border: "1px solid var(--color-border, #e5e0db)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [`${Number(value).toFixed(2).replace(".", ",")} €`]}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px" }}
            />
            <Bar
              dataKey="En ligne"
              stackId="ca"
              fill="#6b4c3b"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="Sur place"
              stackId="ca"
              fill="#c4a882"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function formatWeekLabel(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  });
}
