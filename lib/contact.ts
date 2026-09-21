export interface BookingContact {
  prenom: string;
  nomFamille: string;
  /** "Prénom Nom", stocké dans clients.nom */
  nom: string;
  email: string;
  telephone: string;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** Valide les coordonnées envoyées par le tunnel. Prénom et nom sont obligatoires. */
export function parseBookingContact(raw: unknown): BookingContact | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const prenom = clean(c.prenom);
  const nomFamille = clean(c.nomFamille);
  const email = clean(c.email);
  const telephone = clean(c.telephone);
  if (!prenom || !nomFamille || !email || !telephone) return null;
  return { prenom, nomFamille, nom: `${prenom} ${nomFamille}`, email, telephone };
}
