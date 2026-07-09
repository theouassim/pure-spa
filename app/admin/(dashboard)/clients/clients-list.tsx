"use client";

import { User, Phone, Mail, Calendar, Euro } from "lucide-react";
import type { ClientRow } from "./clients-client";

interface Props {
  clients: ClientRow[];
  loading: boolean;
  onSelect: (client: ClientRow) => void;
}

export function ClientsList({ clients, loading, onSelect }: Props) {
  if (loading) {
    return <p className="py-8 text-center text-sm text-text-muted">Chargement...</p>;
  }

  if (clients.length === 0) {
    return <p className="py-8 text-center text-sm text-text-muted">Aucun client trouvé.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-bg-card">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-medium text-text-muted">
            <th className="px-4 py-3">
              <span className="flex items-center gap-1.5"><User size={12} />Client</span>
            </th>
            <th className="px-4 py-3">
              <span className="flex items-center gap-1.5"><Phone size={12} />Téléphone</span>
            </th>
            <th className="px-4 py-3">
              <span className="flex items-center gap-1.5"><Mail size={12} />Email</span>
            </th>
            <th className="px-4 py-3 text-center">
              <span className="flex items-center justify-center gap-1.5"><Calendar size={12} />RDV</span>
            </th>
            <th className="px-4 py-3">
              <span className="flex items-center gap-1.5"><Calendar size={12} />Dernier RDV</span>
            </th>
            <th className="px-4 py-3 text-right">
              <span className="flex items-center justify-end gap-1.5"><Euro size={12} />Total dépensé</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelect(c)}
              className="cursor-pointer border-b border-border/50 transition-colors last:border-b-0 hover:bg-accent-light/30"
            >
              <td className="px-4 py-3 font-medium text-text">{c.nom}</td>
              <td className="px-4 py-3 text-text">
                {c.telephone || "Non renseigné"}
              </td>
              <td className="px-4 py-3 text-text">
                {c.email || "Non renseigné"}
              </td>
              <td className="px-4 py-3 text-center text-text">{c.nb_rdv}</td>
              <td className="px-4 py-3 text-text">
                {c.dernier_rdv ? formatDate(c.dernier_rdv) : "Aucun"}
              </td>
              <td className="px-4 py-3 text-right font-medium text-text">
                {formatEuros(c.total_depense)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

function formatEuros(centimes: number): string {
  if (centimes === 0) return "0,00 €";
  return `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
}
