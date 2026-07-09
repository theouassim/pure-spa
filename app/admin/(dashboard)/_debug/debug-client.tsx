"use client";

import { useState } from "react";
import { Bug, RefreshCw, Database, Trash2, Mail, Zap } from "lucide-react";

interface ActionResult {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export function DebugClient() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [seedDate, setSeedDate] = useState(new Date().toISOString().split("T")[0]);
  const [seedCount, setSeedCount] = useState("5");

  async function runAction(action: string, params?: Record<string, unknown>) {
    setLoading(action);
    setResult(null);
    const res = await fetch("/api/admin/debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, params }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Bug size={24} className="text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-text">Debug (staging)</h1>
          <p className="text-xs text-text-muted">Outils de test — non disponible en production</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Sync Planity */}
        <DebugCard
          icon={RefreshCw}
          title="Synchro Planity"
          description="Déclencher manuellement le cron de synchronisation iCal."
        >
          <button
            onClick={() => runAction("sync_planity")}
            disabled={loading === "sync_planity"}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading === "sync_planity" ? "animate-spin" : ""} />
            {loading === "sync_planity" ? "Synchro..." : "Lancer la synchro"}
          </button>
        </DebugCard>

        {/* Seed bookings */}
        <DebugCard
          icon={Database}
          title="Créer des bookings test"
          description="Insère des réservations flaggées is_test pour simuler l'activité."
        >
          <div className="flex items-end gap-2">
            <div>
              <label className="mb-0.5 block text-[10px] text-text-muted">Date</label>
              <input
                type="date"
                value={seedDate}
                onChange={(e) => setSeedDate(e.target.value)}
                className="rounded border border-border px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] text-text-muted">Nb</label>
              <input
                type="number"
                min={1}
                max={20}
                value={seedCount}
                onChange={(e) => setSeedCount(e.target.value)}
                className="w-14 rounded border border-border px-2 py-1 text-xs"
              />
            </div>
            <button
              onClick={() => runAction("seed_bookings", { date: seedDate, count: parseInt(seedCount) })}
              disabled={loading === "seed_bookings"}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {loading === "seed_bookings" ? "..." : "Créer"}
            </button>
          </div>
        </DebugCard>

        {/* Seed funnel */}
        <DebugCard
          icon={Zap}
          title="Créer des sessions funnel test"
          description="Insère des funnel_events réalistes flaggés is_test."
        >
          <button
            onClick={() => runAction("seed_funnel", { count: 50 })}
            disabled={loading === "seed_funnel"}
            className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading === "seed_funnel" ? "Création..." : "Créer 50 sessions"}
          </button>
        </DebugCard>

        {/* Purge test data */}
        <DebugCard
          icon={Trash2}
          title="Purger les données de test"
          description="Supprime UNIQUEMENT les enregistrements is_test. Données réelles intactes."
        >
          <button
            onClick={() => runAction("purge_test")}
            disabled={loading === "purge_test"}
            className="flex items-center gap-2 rounded-md border border-error/30 px-4 py-2 text-xs font-medium text-error hover:bg-error/5 disabled:opacity-50"
          >
            <Trash2 size={13} />
            {loading === "purge_test" ? "Purge..." : "Purger les données test"}
          </button>
        </DebugCard>

        {/* Test email */}
        <DebugCard
          icon={Mail}
          title="Tester l'envoi d'email"
          description="Envoie un email de vérification via Resend."
        >
          <div className="flex items-end gap-2">
            <input
              type="email"
              placeholder="email@test.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1 rounded border border-border px-2 py-1.5 text-xs"
            />
            <button
              onClick={() => runAction("test_email", { email: testEmail })}
              disabled={loading === "test_email" || !testEmail}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {loading === "test_email" ? "..." : "Envoyer"}
            </button>
          </div>
        </DebugCard>
      </div>

      {/* Result panel */}
      {result && (
        <div className={`rounded-md border p-3 text-xs ${result.error ? "border-error/30 bg-error/5" : "border-success/30 bg-success/5"}`}>
          <pre className="whitespace-pre-wrap break-all text-text">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function DebugCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={14} className="text-primary" />
        <h3 className="text-sm font-medium text-text">{title}</h3>
      </div>
      <p className="mb-3 text-[11px] text-text-muted">{description}</p>
      {children}
    </div>
  );
}
