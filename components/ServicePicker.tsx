"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ServiceData } from "./BookingFunnel";

interface CategoryConfig {
  nom: string;
  ouverte_par_defaut: boolean;
  position: number;
}

interface Props {
  services: ServiceData[];
  telephoneContact: string;
  loading: boolean;
  categories: CategoryConfig[];
  onSelect: (service: ServiceData) => void;
}

export function ServicePicker({ services, telephoneContact, loading, categories, onSelect }: Props) {
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

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const posA = categories.find((c) => c.nom === a)?.position ?? 999;
    const posB = categories.find((c) => c.nom === b)?.position ?? 999;
    return posA - posB || a.localeCompare(b);
  });

  return (
    <div className="flex flex-col gap-2">
      {sortedCategories.map((categorie, idx) => (
        <CategoryAccordion
          key={categorie}
          categorie={categorie}
          services={grouped[categorie]}
          telephoneContact={telephoneContact}
          defaultOpen={
            categories.find((c) => c.nom === categorie)?.ouverte_par_defaut ?? idx === 0
          }
          expandedServiceId={expandedId}
          onToggleDescription={setExpandedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function CategoryAccordion({
  categorie,
  services,
  telephoneContact,
  defaultOpen,
  expandedServiceId,
  onToggleDescription,
  onSelect,
}: {
  categorie: string;
  services: ServiceData[];
  telephoneContact: string;
  defaultOpen: boolean;
  expandedServiceId: string | null;
  onToggleDescription: (id: string | null) => void;
  onSelect: (service: ServiceData) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-card hover:bg-accent-light/30 transition-colors"
      >
        <span className="text-sm font-semibold text-text">{categorie}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{services.length} soin{services.length > 1 ? "s" : ""}</span>
          <ChevronDown
            size={16}
            className={`text-text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border/50">
          {services.map((service) => (
            <ServiceItem
              key={service.id}
              service={service}
              telephoneContact={telephoneContact}
              expanded={expandedServiceId === service.id}
              onToggleDescription={() =>
                onToggleDescription(expandedServiceId === service.id ? null : service.id)
              }
              onSelect={() => onSelect(service)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceItem({
  service,
  telephoneContact,
  expanded,
  onToggleDescription,
  onSelect,
}: {
  service: ServiceData;
  telephoneContact: string;
  expanded: boolean;
  onToggleDescription: () => void;
  onSelect: () => void;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-text">{service.nom}</h3>
            <span className="text-xs text-text-muted bg-accent-light px-2 py-0.5 rounded-full">
              {formatDuration(service.duree_minutes)}
            </span>
          </div>
          {service.description && (
            <div className="mt-1">
              {expanded ? (
                <>
                  <p className="text-xs text-text-muted leading-relaxed">{service.description}</p>
                  <button
                    onClick={onToggleDescription}
                    className="text-xs text-text-muted/70 hover:text-text mt-0.5"
                  >
                    Masquer
                  </button>
                </>
              ) : (
                <button
                  onClick={onToggleDescription}
                  className="text-xs text-primary-light hover:text-primary transition-colors"
                >
                  Détails
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-sm font-semibold text-text">
            {formatPrice(service.prix)}
          </span>
          {service.reservable_en_ligne ? (
            <button
              onClick={onSelect}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-dark"
            >
              Choisir
            </button>
          ) : (
            <span className="text-xs text-text-muted text-right max-w-[140px]">
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
  );
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}
