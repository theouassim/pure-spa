"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/tracking";
import type { ContactData } from "./BookingFunnel";

interface Props {
  onSubmit: (data: ContactData) => void;
  onBack: () => void;
  verifying: boolean;
}

export function ContactForm({ onSubmit, onBack, verifying }: Props) {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [consentRgpd, setConsentRgpd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!trackedRef.current) {
      track("details_started");
      trackedRef.current = true;
    }
  }, []);

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!nom.trim()) errs.nom = "Veuillez saisir votre nom";
    if (!email.trim()) {
      errs.email = "Veuillez saisir votre email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Email invalide";
    }
    if (!telephone.trim()) {
      errs.telephone = "Veuillez saisir votre téléphone";
    } else if (!/^[\d\s+().-]{8,}$/.test(telephone.trim())) {
      errs.telephone = "Numéro de téléphone invalide";
    }
    if (!consentRgpd) {
      errs.consentRgpd = "Vous devez accepter pour continuer";
    }
    return errs;
  }

  function handleSubmit() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit({ nom: nom.trim(), email: email.trim(), telephone: telephone.trim() });
  }

  return (
    <div className="max-w-md mx-auto">
      <button
        onClick={onBack}
        className="text-sm text-primary hover:text-primary-dark transition-colors mb-6"
      >
        &larr; Changer de créneau
      </button>

      <h2 className="text-lg font-semibold text-text mb-6">Vos coordonnées</h2>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">Nom complet</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-card px-4 py-2.5 text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            placeholder="Marie Dupont"
          />
          {errors.nom && <p className="mt-1 text-xs text-error">{errors.nom}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-card px-4 py-2.5 text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            placeholder="marie@example.com"
          />
          {errors.email && <p className="mt-1 text-xs text-error">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">Téléphone</label>
          <input
            type="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-card px-4 py-2.5 text-text focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            placeholder="06 12 34 56 78"
          />
          {errors.telephone && <p className="mt-1 text-xs text-error">{errors.telephone}</p>}
        </div>

        <div className="mt-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={consentRgpd}
              onChange={(e) => setConsentRgpd(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs text-text-muted leading-relaxed">
              J&apos;accepte que mes données soient utilisées pour gérer ma réservation.{" "}
              <a href="/confidentialite" className="text-primary underline">
                Politique de confidentialité
              </a>
            </span>
          </label>
          {errors.consentRgpd && (
            <p className="mt-1 text-xs text-error">{errors.consentRgpd}</p>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={verifying}
          className="mt-4 w-full rounded-full bg-primary py-3 text-white font-medium transition-colors hover:bg-primary-dark disabled:opacity-60 disabled:cursor-wait"
        >
          {verifying ? "Vérification du créneau…" : "Valider et continuer"}
        </button>
      </div>
    </div>
  );
}
