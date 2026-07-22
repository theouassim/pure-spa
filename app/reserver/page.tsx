import Image from "next/image";
import { BookingPage } from "@/components/BookingPage";

export const metadata = {
  title: "Réserver un soin — Pure Spa Institut",
  description: "Choisissez votre prestation et réservez en ligne en quelques clics.",
};

export default function ReserverPage() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-border bg-bg-card py-3 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center">
          <Image src="/logo.png" alt="Pure SPA" width={120} height={36} className="md:w-[140px] md:h-auto" priority />
        </div>
      </header>
      <BookingPage />
    </main>
  );
}
