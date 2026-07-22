"use client";

import { useState, useEffect } from "react";
import { Cookie, Check, X, Settings } from "lucide-react";
import { getConsent, setConsent, type ConsentCategories } from "@/lib/consent";
import Link from "next/link";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [categories, setCategories] = useState<ConsentCategories>({
    analytics: true,
    marketing: true,
  });

  useEffect(() => {
    if (!getConsent()) {
      setVisible(true);
    }
  }, []);

  function acceptAll() {
    setConsent({ analytics: true, marketing: true });
    setVisible(false);
    window.dispatchEvent(new Event("consent-updated"));
  }

  function refuseAll() {
    setConsent({ analytics: false, marketing: false });
    setVisible(false);
    window.dispatchEvent(new Event("consent-updated"));
  }

  function saveCustom() {
    setConsent(categories);
    setVisible(false);
    window.dispatchEvent(new Event("consent-updated"));
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] p-4">
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-bg-card p-5 shadow-lg">
        <div className="flex items-start gap-3 mb-4">
          <Cookie size={20} className="text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-text">
              Gestion des cookies
            </h3>
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              Nous utilisons des cookies pour mesurer l&apos;audience et améliorer
              votre expérience. Vous pouvez accepter, refuser ou personnaliser vos
              préférences.{" "}
              <Link
                href="/confidentialite"
                className="underline text-primary hover:text-primary-dark"
              >
                Politique de confidentialité
              </Link>
            </p>
          </div>
        </div>

        {showDetails && (
          <div className="mb-4 space-y-3 rounded-lg border border-border bg-bg p-3">
            <label className="flex items-center gap-3 cursor-not-allowed opacity-70">
              <input
                type="checkbox"
                checked
                disabled
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-xs text-text">
                <strong>Essentiels</strong> — toujours actifs (fonctionnement du site)
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={categories.analytics}
                onChange={(e) =>
                  setCategories({ ...categories, analytics: e.target.checked })
                }
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-xs text-text">
                <strong>Analytiques</strong> — mesure d&apos;audience (Google Analytics)
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={categories.marketing}
                onChange={(e) =>
                  setCategories({ ...categories, marketing: e.target.checked })
                }
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-xs text-text">
                <strong>Marketing</strong> — publicité ciblée (Meta Pixel)
              </span>
            </label>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {showDetails ? (
            <button
              onClick={saveCustom}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-dark transition-colors"
            >
              <Check size={14} />
              Enregistrer mes choix
            </button>
          ) : (
            <>
              <button
                onClick={acceptAll}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-dark transition-colors"
              >
                <Check size={14} />
                Tout accepter
              </button>
              <button
                onClick={refuseAll}
                className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-text-muted hover:bg-accent-light transition-colors"
              >
                <X size={14} />
                Tout refuser
              </button>
              <button
                onClick={() => setShowDetails(true)}
                className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-text-muted hover:bg-accent-light transition-colors"
              >
                <Settings size={14} />
                Personnaliser
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
