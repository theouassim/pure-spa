"use client";

import { useState } from "react";
import type { ServiceData } from "./BookingFunnel";

interface Props {
  services: ServiceData[];
  telephoneContact: string;
  loading: boolean;
  onSelect: (service: ServiceData) => void;
}

export function ServicePicker({ services, telephoneContact, loading, onSelect }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-border/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <p className="text-center text-text-muted py-12">
        Aucune prestation disponible pour le moment.
      </p>
    );
  }

  const grouped = services.reduce<Record<string, ServiceData[]>>((acc, s) => {
    const key = s.categorie.trim();
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  function formatPrice(cents: number) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(cents / 100);
  }

  function formatDuration(minutes: number) {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
  }

  return (
    <div className="flex flex-col gap-8">
      {Object.entries(grouped).map(([categorie, items]) => (
        <section key={categorie}>
          <h2 className="text-lg font-semibold text-primary mb-3">{categorie}</h2>
          <div className="flex flex-col gap-3">
            {items.map((service) => (
              <div
                key={service.id}
                className="rounded-lg border border-border bg-bg-card p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-medium text-text">{service.nom}</h3>
                      <span className="text-xs text-text-muted bg-accent-light px-2 py-0.5 rounded-full">
                        {formatDuration(service.duree_minutes)}
                      </span>
                    </div>
                    {service.description && (
                      <div className="mt-1">
                        {expandedId === service.id ? (
                          <p className="text-sm text-text-muted">{service.description}</p>
                        ) : (
                          <button
                            onClick={() => setExpandedId(service.id)}
                            className="text-sm text-primary-light hover:text-primary transition-colors"
                          >
                            Détails
                          </button>
                        )}
                        {expandedId === service.id && (
                          <button
                            onClick={() => setExpandedId(null)}
                            className="text-xs text-text-muted ml-2 hover:text-text"
                          >
                            Masquer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="font-semibold text-text">
                      {formatPrice(service.prix)}
                    </span>
                    {service.reservable_en_ligne ? (
                      <button
                        onClick={() => onSelect(service)}
                        className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                      >
                        Choisir
                      </button>
                    ) : (
                      <span className="text-xs text-text-muted text-right max-w-[160px]">
                        Réservation par téléphone
                        {telephoneContact && (
                          <>
                            {" "}au{" "}
                            <a
                              href={`tel:${telephoneContact}`}
                              className="text-primary font-medium whitespace-nowrap"
                            >
                              {telephoneContact}
                            </a>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
