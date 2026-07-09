"use client";

import { Euro, CreditCard, Wallet, Clock, Calendar } from "lucide-react";
import type { FacturationKpis } from "./facturation-client";

interface Props {
  kpis: FacturationKpis | null;
  loading: boolean;
}

export function KpiCards({ kpis, loading }: Props) {
  if (loading || !kpis) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-bg-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        icon={Euro}
        label="CA encaissé"
        value={formatEuros(kpis.ca_encaisse)}
        sub={`En ligne : ${formatEuros(kpis.ca_en_ligne)} · Sur place : ${formatEuros(kpis.ca_sur_place)}`}
        accent
      />
      <KpiCard
        icon={Clock}
        label="En attente"
        value={formatEuros(kpis.montant_en_attente)}
        sub="À encaisser"
        muted={kpis.montant_en_attente === 0}
      />
      <KpiCard
        icon={Calendar}
        label="Rendez-vous"
        value={String(kpis.nb_rdv)}
        sub="Hors annulés"
      />
      <KpiCard
        icon={CreditCard}
        label="En ligne"
        value={formatEuros(kpis.ca_en_ligne)}
        subIcon={Wallet}
        sub={`Sur place : ${formatEuros(kpis.ca_sur_place)}`}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  subIcon: SubIcon,
  accent,
  muted,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  sub?: string;
  subIcon?: React.ComponentType<{ size?: number; className?: string }>;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted">
        <Icon size={14} />
        {label}
      </div>
      <p className={`mt-2 text-xl font-bold ${accent ? "text-primary" : muted ? "text-text-muted" : "text-text"}`}>
        {value}
      </p>
      {sub && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-text-muted">
          {SubIcon && <SubIcon size={10} />}
          {sub}
        </p>
      )}
    </div>
  );
}

function formatEuros(centimes: number): string {
  if (centimes === 0) return "0,00 €";
  return `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
}
