"use client";

import { useEffect, useState } from "react";
import { Clock, MapPin, Navigation } from "lucide-react";

interface HoraireOuverture {
  jour: number;
  ouverture: string;
  fermeture: string;
}

interface Pause {
  debut: string;
  fin: string;
}

interface HorairesData {
  horaires_ouverture: HoraireOuverture[];
  jours_travailles: number[];
  pauses: Pause[];
}

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function formatHoraires(
  jour: number,
  horaires: HoraireOuverture[],
  joursTravailles: number[],
  pauses: Pause[]
): string {
  if (!joursTravailles.includes(jour)) return "Fermé";

  const h = horaires.find((ho) => ho.jour === jour);
  if (!h) return "Fermé";

  if (pauses.length === 0) {
    return `${h.ouverture} - ${h.fermeture}`;
  }

  const sortedPauses = [...pauses].sort((a, b) => a.debut.localeCompare(b.debut));
  const plages: string[] = [];
  let currentStart = h.ouverture;

  for (const pause of sortedPauses) {
    if (pause.debut > currentStart && pause.debut < h.fermeture) {
      plages.push(`${currentStart} - ${pause.debut}`);
      currentStart = pause.fin;
    }
  }

  if (currentStart < h.fermeture) {
    plages.push(`${currentStart} - ${h.fermeture}`);
  }

  return plages.join(", ");
}

export function AboutSection() {
  const [horaires, setHoraires] = useState<HorairesData | null>(null);

  useEffect(() => {
    fetch("/api/horaires")
      .then((res) => res.json())
      .then((data) => setHoraires(data))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Adresse */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text mb-2">
          <MapPin size={15} className="text-primary" />
          Adresse
        </h3>
        <p className="text-sm text-text-muted leading-relaxed">
          36 Rue Aristide Briand, 69800 Saint-Priest
        </p>
        <a
          href="https://www.google.com/maps/search/?api=1&query=36+Rue+Aristide+Briand+69800+Saint-Priest"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-primary hover:text-primary-dark transition-colors"
        >
          <Navigation size={12} />
          Voir sur Google Maps
        </a>
      </section>

      {/* Horaires */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text mb-2">
          <Clock size={15} className="text-primary" />
          Horaires d&apos;ouverture
        </h3>
        {!horaires ? (
          <div className="space-y-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-5 rounded bg-border/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {JOURS.map((nom, idx) => {
              const jour = idx + 1;
              const texte = formatHoraires(
                jour,
                horaires.horaires_ouverture,
                horaires.jours_travailles,
                horaires.pauses
              );
              const isFerme = texte === "Fermé";
              return (
                <div key={jour} className="flex justify-between text-sm">
                  <span className={isFerme ? "text-text-muted" : "text-text"}>
                    {nom}
                  </span>
                  <span className={isFerme ? "text-text-muted/60" : "text-text-muted"}>
                    {texte}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Accès */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text mb-2">
          <Navigation size={15} className="text-primary" />
          Accès
        </h3>
        <p className="text-sm text-text-muted leading-relaxed">
          Pure Spa est situé au 36 rue Aristide Briand, 69800 Saint-Priest, en centre-ville.
          Le salon se trouve à l&apos;angle de la rue, à côté du Vival. Il est accessible en
          voiture, à pied ou en transports en commun, avec plusieurs lignes de bus à
          proximité. Des places de stationnement sont disponibles autour du salon. L&apos;entrée se
          fait directement depuis la rue. Nous vous conseillons d&apos;arriver quelques minutes
          avant votre rendez-vous.
        </p>
      </section>

      {/* Présentation */}
      <section>
        <h3 className="text-sm font-semibold text-text mb-2">À propos</h3>
        <p className="text-sm text-text-muted leading-relaxed">
          Bienvenue chez Pure SPA, l&apos;endroit 100% femmes, où la beauté de vos cheveux prend
          toute son attention. Situé au cœur de Saint-Priest, notre institut de Hair Spa vous
          invite à vivre une expérience unique de relaxation et de soin, alliant expertise
          capillaire et bien-être absolu. Ici, chaque cliente est traitée avec soin et
          bienveillance. Nous vous offrons une gamme de prestations sur-mesure, adaptées à vos
          besoins spécifiques.
        </p>
      </section>
    </div>
  );
}
