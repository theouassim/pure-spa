"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import { ClientsList } from "./clients-list";
import { ClientDetailPanel } from "./client-detail-panel";

export interface ClientRow {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
  created_at: string;
  nb_rdv: number;
  total_depense: number;
  montant_en_attente: number;
  dernier_rdv: string | null;
  premier_rdv: string | null;
}

export function ClientsClient() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"dernier_rdv" | "total_depense">("dernier_rdv");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQuery.length >= 2) params.set("q", searchQuery);
    params.set("sort", sortBy);
    params.set("dir", sortDir);

    const res = await fetch(`/api/admin/clients/stats?${params.toString()}`);
    const data = await res.json();
    setClients(data.clients ?? []);
    setLoading(false);
  }, [searchQuery, sortBy, sortDir]);

  useEffect(() => {
    const timer = setTimeout(fetchClients, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchClients, searchQuery]);

  function toggleSort(field: "dernier_rdv" | "total_depense") {
    if (sortBy === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  return (
    <div className="space-y-4">
      {/* Barre de recherche + tri */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-text-muted" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-72 rounded-md border border-border bg-bg-card py-2 pl-8 pr-3 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-text-muted" />
          <button
            onClick={() => toggleSort("dernier_rdv")}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              sortBy === "dernier_rdv"
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-text-muted hover:bg-accent-light"
            }`}
          >
            Dernier RDV {sortBy === "dernier_rdv" && (sortDir === "desc" ? "↓" : "↑")}
          </button>
          <button
            onClick={() => toggleSort("total_depense")}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              sortBy === "total_depense"
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-text-muted hover:bg-accent-light"
            }`}
          >
            Total dépensé {sortBy === "total_depense" && (sortDir === "desc" ? "↓" : "↑")}
          </button>
        </div>
      </div>

      {/* Liste */}
      <ClientsList
        clients={clients}
        loading={loading}
        onSelect={setSelectedClient}
      />

      {/* Détail */}
      {selectedClient && (
        <ClientDetailPanel
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
}
