export type BookingStatus = "pending" | "confirmed" | "cancelled";
export type StatutPaiement = "paye_en_ligne" | "en_attente" | "paye_sur_place";

export interface Service {
  id: string;
  nom: string;
  duree_minutes: number;
  prix: number; // centimes d'euros
  description: string | null;
  categorie: string;
  actif: boolean;
  reservable_en_ligne: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  service_id: string;
  client_id: string;
  start_at: string;
  end_at: string;
  slot_number: number;
  statut: BookingStatus;
  montant: number | null;
  statut_paiement: StatutPaiement;
  stripe_payment_id: string | null;
  created_at: string;
}

export interface ExternalBooking {
  id: string;
  source: string;
  start_at: string;
  end_at: string;
  raw_uid: string;
  synced_at: string;
}

export interface HoraireOuverture {
  jour: number; // 1=lundi à 7=dimanche
  ouverture: string; // "HH:mm"
  fermeture: string; // "HH:mm"
}

export interface Pause {
  debut: string; // "HH:mm"
  fin: string; // "HH:mm"
}

export interface AdminSettings {
  id: string;
  horaires_ouverture: HoraireOuverture[];
  jours_travailles: number[];
  pauses: Pause[];
  nb_salles: number;
  delai_min_avant_rdv: number;
  battement_minutes: number;
  conditions_annulation: string;
  telephone_contact: string;
  timezone: string;
  mode_paiement: "total" | "acompte";
  acompte_pourcentage: number;
  updated_at: string;
}
