"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, Shield, Mail, Trash2, ChevronDown } from "lucide-react";
import { InfoTooltip } from "../components/info-tooltip";

interface Member {
  id: string;
  user_id: string;
  email: string;
  role: "owner" | "membre";
  status: "active" | "invited" | "revoked";
  created_at: string;
}

export function MembresSection() {
  const [members, setMembers] = useState<Member[]>([]);
  const [currentRole, setCurrentRole] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"membre" | "owner">("membre");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function fetchMembers() {
    const res = await fetch("/api/admin/members");
    const data = await res.json();
    setMembers(data.members ?? []);
    setCurrentRole(data.currentRole ?? "");
    setCurrentUserId(data.currentUserId ?? "");
    setLoading(false);
  }

  useEffect(() => {
    fetchMembers();
  }, []);

  const isOwner = currentRole === "owner";

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setInviting(true);

    const res = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });

    const data = await res.json();
    setInviting(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'invitation.");
      return;
    }

    setSuccess(`Invitation envoyée à ${inviteEmail}`);
    setInviteEmail("");
    setShowInvite(false);
    fetchMembers();
  }

  async function handleRevoke(memberId: string) {
    setError(null);
    const res = await fetch(`/api/admin/members/${memberId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    fetchMembers();
  }

  async function handleRoleChange(memberId: string, newRole: "owner" | "membre") {
    setError(null);
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    fetchMembers();
  }

  if (loading) {
    return <div className="h-32 animate-pulse rounded-lg border border-border bg-bg-card" />;
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-text">Équipe</h2>
          <InfoTooltip text="Owner : accès complet + gestion des comptes. Membre : accès dashboard sans gestion des comptes." />
        </div>
        {isOwner && (
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-accent-light"
          >
            <UserPlus size={13} />
            Inviter
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-xs text-error">{error}</p>}
      {success && <p className="mb-3 text-xs text-success">{success}</p>}

      {/* Formulaire invitation */}
      {showInvite && isOwner && (
        <form onSubmit={handleInvite} className="mb-4 rounded-md border border-border p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-text-muted">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-2.5 top-2.5 text-text-muted" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="membre@example.com"
                  className="w-full rounded-md border border-border py-2 pl-8 pr-3 text-sm"
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Rôle</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "owner" | "membre")}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                <option value="membre">Membre</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {inviting ? "Envoi..." : "Envoyer l'invitation"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            Un lien d&apos;invitation sera envoyé par email. L&apos;invité définira son mot de passe lui-même.
          </p>
        </form>
      )}

      {/* Liste des membres */}
      <div className="divide-y divide-border/50">
        {members.map((m) => {
          const isSelf = m.user_id === currentUserId;
          return (
            <div key={m.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  m.role === "owner" ? "bg-primary/10" : "bg-accent-light"
                }`}>
                  {m.role === "owner" ? (
                    <Shield size={14} className="text-primary" />
                  ) : (
                    <Users size={14} className="text-text-muted" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">{m.email}</span>
                    {isSelf && <span className="rounded bg-accent-light px-1.5 py-0.5 text-[10px] text-text-muted">Vous</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <span className={m.role === "owner" ? "font-medium text-primary" : ""}>
                      {m.role === "owner" ? "Owner" : "Membre"}
                    </span>
                    <span>·</span>
                    <StatusBadge status={m.status} />
                    <span>·</span>
                    <span>Ajouté le {formatDate(m.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Actions (owner uniquement, pas sur soi-même) */}
              {isOwner && !isSelf && m.status !== "revoked" && (
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value as "owner" | "membre")}
                      className="appearance-none rounded-md border border-border bg-bg px-2 py-1 pr-6 text-xs"
                    >
                      <option value="membre">Membre</option>
                      <option value="owner">Owner</option>
                    </select>
                    <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1.5 text-text-muted" />
                  </div>
                  <button
                    onClick={() => handleRevoke(m.id)}
                    className="rounded p-1.5 text-text-muted hover:bg-error/5 hover:text-error"
                    title="Révoquer l'accès"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isOwner && (
        <p className="mt-3 text-[11px] text-text-muted">
          Seul un owner peut gérer les membres de l&apos;équipe.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return <span className="text-success">Actif</span>;
  }
  if (status === "invited") {
    return <span className="text-primary-dark">Invitation en attente</span>;
  }
  return <span className="text-text-muted">Révoqué</span>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}
