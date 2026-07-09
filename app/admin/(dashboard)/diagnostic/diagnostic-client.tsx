"use client";

import { useState, useEffect } from "react";
import { HeartPulse, CheckCircle, AlertTriangle, Activity, RefreshCw, CreditCard, Calendar } from "lucide-react";

interface DiagnosticData {
  global_status: "ok" | "warning" | "error";
  planity: {
    sources: Record<string, { last_sync: string; count: number }>;
    total_events: number;
    status: "ok" | "stale" | "no_data";
  };
  stripe: {
    last_payment: string | null;
  };
  funnel: {
    events_last_24h: number;
    status: "ok" | "no_activity";
  };
  last_booking: string | null;
}

export function DiagnosticClient() {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchDiagnostic() {
    setLoading(true);
    const res = await fetch("/api/admin/diagnostic");
    if (!res.ok) {
      setError("Impossible de charger le diagnostic.");
      setLoading(false);
      return;
    }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    fetchDiagnostic();
  }, []);

  if (loading) {
    return <p className="py-8 text-center text-sm text-text-muted">Chargement du diagnostic...</p>;
  }

  if (error || !data) {
    return <p className="py-8 text-center text-sm text-error">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HeartPulse size={24} className="text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-text">Diagnostic système</h1>
            <p className="text-xs text-text-muted">Lecture seule — aucune action possible ici</p>
          </div>
        </div>
        <button
          onClick={fetchDiagnostic}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-accent-light"
        >
          <RefreshCw size={12} />
          Rafraîchir
        </button>
      </div>

      {/* Statut global */}
      <GlobalStatus status={data.global_status} />

      {/* Indicateurs */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Planity */}
        <HealthCard
          icon={Calendar}
          title="Synchro Planity"
          status={data.planity.status === "ok" ? "ok" : data.planity.status === "stale" ? "warning" : "neutral"}
        >
          {Object.keys(data.planity.sources).length === 0 ? (
            <p className="text-xs text-text-muted">Aucune synchro enregistrée.</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(data.planity.sources).map(([source, info]) => (
                <div key={source} className="flex items-center justify-between text-xs">
                  <span className="text-text">{source}</span>
                  <span className="text-text-muted">{formatRelative(info.last_sync)} · {info.count} events</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-text-muted">
            Total events importés : {data.planity.total_events}
          </p>
        </HealthCard>

        {/* Stripe */}
        <HealthCard
          icon={CreditCard}
          title="Paiements Stripe"
          status={data.stripe.last_payment ? "ok" : "neutral"}
        >
          <p className="text-xs text-text">
            Dernier paiement en ligne : {data.stripe.last_payment ? formatRelative(data.stripe.last_payment) : "Aucun"}
          </p>
        </HealthCard>

        {/* Funnel */}
        <HealthCard
          icon={Activity}
          title="Tracking funnel"
          status={data.funnel.status === "ok" ? "ok" : "warning"}
        >
          <p className="text-xs text-text">
            Events (24h) : <span className="font-semibold">{data.funnel.events_last_24h}</span>
          </p>
          {data.funnel.status === "no_activity" && (
            <p className="mt-1 text-[11px] text-error/80">Aucune activité funnel depuis 24h.</p>
          )}
        </HealthCard>

        {/* Dernière résa */}
        <HealthCard
          icon={Calendar}
          title="Dernière réservation"
          status={data.last_booking ? "ok" : "neutral"}
        >
          <p className="text-xs text-text">
            {data.last_booking ? formatRelative(data.last_booking) : "Aucune réservation"}
          </p>
        </HealthCard>
      </div>

      <p className="text-[11px] text-text-muted">
        Logs détaillés disponibles sur le dashboard Vercel (onglet Functions).
      </p>
    </div>
  );
}

function GlobalStatus({ status }: { status: "ok" | "warning" | "error" }) {
  if (status === "ok") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
        <CheckCircle size={18} className="text-success" />
        <span className="text-sm font-medium text-success">Tout fonctionne</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-error/30 bg-error/5 px-4 py-3">
      <AlertTriangle size={18} className="text-error" />
      <span className="text-sm font-medium text-error">
        {status === "warning" ? "Attention — vérifiez les indicateurs ci-dessous" : "Problème détecté"}
      </span>
    </div>
  );
}

function HealthCard({
  icon: Icon,
  title,
  status,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  status: "ok" | "warning" | "neutral";
  children: React.ReactNode;
}) {
  const borderColor = status === "ok" ? "border-success/20" : status === "warning" ? "border-error/20" : "border-border";

  return (
    <div className={`rounded-lg border bg-bg-card p-4 ${borderColor}`}>
      <div className="mb-2 flex items-center gap-2">
        <Icon size={14} className="text-primary" />
        <h3 className="text-sm font-medium text-text">{title}</h3>
        {status === "ok" && <CheckCircle size={12} className="text-success" />}
        {status === "warning" && <AlertTriangle size={12} className="text-error" />}
      </div>
      {children}
    </div>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Il y a ${diffD}j`;
}
