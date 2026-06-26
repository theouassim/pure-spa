"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/tracking";
import { ServicePicker } from "./ServicePicker";
import { SlotPicker } from "./SlotPicker";
import { ContactForm } from "./ContactForm";
import { BookingSummary } from "./BookingSummary";

export interface ServiceData {
  id: string;
  nom: string;
  duree_minutes: number;
  prix: number;
  description: string | null;
  categorie: string;
  reservable_en_ligne: boolean;
}

export interface SlotData {
  start: string;
  end: string;
}

export interface ContactData {
  nom: string;
  email: string;
  telephone: string;
}

type Step = "service" | "slot" | "contact" | "summary";

const STEP_LABELS: Record<Step, string> = {
  service: "Prestation",
  slot: "Date & heure",
  contact: "Coordonnées",
  summary: "Récapitulatif",
};

const STEPS: Step[] = ["service", "slot", "contact", "summary"];

export function BookingFunnel() {
  const [step, setStep] = useState<Step>("service");
  const [services, setServices] = useState<ServiceData[]>([]);
  const [telephoneContact, setTelephoneContact] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedService, setSelectedService] = useState<ServiceData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);
  const [contact, setContact] = useState<ContactData | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [slotExpired, setSlotExpired] = useState(false);

  useEffect(() => {
    track("funnel_start");
    fetchServices();
  }, []);

  async function fetchServices() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setServices(data.services);
      setTelephoneContact(data.telephone_contact);
    } catch {
      setError("Impossible de charger les prestations. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }

  function handleServiceSelect(service: ServiceData) {
    setSelectedService(service);
    setSelectedSlot(null);
    setContact(null);
    setSlotExpired(false);
    track("service_selected", {
      service_id: service.id,
      service_name: service.nom,
      price: service.prix,
    });
    setStep("slot");
  }

  function handleSlotSelect(slot: SlotData) {
    setSelectedSlot(slot);
    track("slot_selected", { start: slot.start, end: slot.end });
    setStep("contact");
  }

  async function handleContactSubmit(data: ContactData) {
    setContact(data);
    track("booking_submitted", {
      service_id: selectedService!.id,
      start: selectedSlot!.start,
    });

    setVerifying(true);
    setSlotExpired(false);

    try {
      const res = await fetch("/api/slots/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService!.id,
          start: selectedSlot!.start,
        }),
      });

      if (!res.ok) throw new Error();
      const { available } = await res.json();

      if (!available) {
        track("slot_expired", {
          service_id: selectedService!.id,
          start: selectedSlot!.start,
        });
        setSlotExpired(true);
        setVerifying(false);
        return;
      }

      setStep("summary");
    } catch {
      setError("Erreur lors de la vérification. Veuillez réessayer.");
    } finally {
      setVerifying(false);
    }
  }

  function handleBackToSlots() {
    setSlotExpired(false);
    setSelectedSlot(null);
    setStep("slot");
  }

  function goToStep(target: Step) {
    const targetIdx = STEPS.indexOf(target);
    const currentIdx = STEPS.indexOf(step);
    if (targetIdx < currentIdx) {
      setStep(target);
    }
  }

  const currentStepIdx = STEPS.indexOf(step);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Progress bar */}
      <nav className="mb-8">
        <ol className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => goToStep(s)}
                disabled={i >= currentStepIdx}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  i === currentStepIdx
                    ? "text-primary"
                    : i < currentStepIdx
                      ? "text-primary-light cursor-pointer hover:text-primary"
                      : "text-text-muted/50 cursor-default"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    i === currentStepIdx
                      ? "bg-primary text-white"
                      : i < currentStepIdx
                        ? "bg-primary-light/20 text-primary"
                        : "bg-border text-text-muted/50"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px ${
                    i < currentStepIdx ? "bg-primary-light" : "bg-border"
                  }`}
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          {error}
          <button
            onClick={() => {
              setError(null);
              if (step === "service") fetchServices();
            }}
            className="ml-2 underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Slot expired warning */}
      {slotExpired && (
        <div className="mb-6 rounded-lg bg-error/10 border border-error/20 px-4 py-3 text-sm text-error">
          Ce créneau n&apos;est plus disponible. Une autre cliente l&apos;a réservé entre-temps.
          <button onClick={handleBackToSlots} className="ml-2 underline font-medium">
            Choisir un autre créneau
          </button>
        </div>
      )}

      {/* Steps */}
      {step === "service" && (
        <ServicePicker
          services={services}
          telephoneContact={telephoneContact}
          loading={loading}
          onSelect={handleServiceSelect}
        />
      )}

      {step === "slot" && selectedService && (
        <SlotPicker
          service={selectedService}
          onSelect={handleSlotSelect}
          onBack={() => setStep("service")}
        />
      )}

      {step === "contact" && (
        <ContactForm
          onSubmit={handleContactSubmit}
          onBack={() => setStep("slot")}
          verifying={verifying}
        />
      )}

      {step === "summary" && selectedService && selectedSlot && contact && (
        <BookingSummary
          service={selectedService}
          slot={selectedSlot}
          contact={contact}
          onSlotExpired={handleBackToSlots}
        />
      )}
    </div>
  );
}
