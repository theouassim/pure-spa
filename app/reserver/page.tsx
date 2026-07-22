import Image from "next/image";
import { BookingPage } from "@/components/BookingPage";

export const metadata = {
  title: "Réserver un soin — Pure Spa Institut",
  description: "Choisissez votre prestation et réservez en ligne en quelques clics.",
};

export default function ReserverPage() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-border bg-bg-card py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Image src="/logo.png" alt="Pure SPA" width={140} height={42} priority />
          <span className="text-sm text-text-muted hidden sm:inline">Réservation en ligne</span>
        </div>
      </header>
      <BookingPage />
    </main>
  );
}
