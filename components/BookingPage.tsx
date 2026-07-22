"use client";

import { useState } from "react";
import { Calendar, Info } from "lucide-react";
import { BookingFunnel } from "./BookingFunnel";
import { AboutSection } from "./AboutSection";

type Tab = "rdv" | "about";

export function BookingPage() {
  const [tab, setTab] = useState<Tab>("rdv");

  return (
    <div className="flex-1">
      {/* Mobile: tabs */}
      <nav className="md:hidden border-b border-border bg-bg-card sticky top-0 z-10">
        <div className="flex">
          <button
            onClick={() => setTab("rdv")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === "rdv"
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            <Calendar size={16} />
            Prendre RDV
          </button>
          <button
            onClick={() => setTab("about")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === "about"
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            <Info size={16} />
            À propos
          </button>
        </div>
      </nav>

      {/* Mobile: tab content */}
      <div className="md:hidden">
        {tab === "rdv" && (
          <div className="py-6">
            <BookingFunnel />
          </div>
        )}
        {tab === "about" && (
          <div className="px-4 py-6 max-w-lg mx-auto">
            <AboutSection />
          </div>
        )}
      </div>

      {/* Desktop: side-by-side layout */}
      <div className="hidden md:flex max-w-6xl mx-auto gap-8 py-8 px-4">
        <div className="flex-1 min-w-0">
          <BookingFunnel />
        </div>
        <aside className="w-80 shrink-0">
          <div className="sticky top-8">
            <AboutSection />
          </div>
        </aside>
      </div>
    </div>
  );
}
