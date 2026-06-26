import { BookingFunnel } from "@/components/BookingFunnel";

export const metadata = {
  title: "Réserver un soin — Pure Spa Institut",
  description: "Choisissez votre prestation et réservez en ligne en quelques clics.",
};

export default function ReserverPage() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-border bg-bg-card py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-primary tracking-tight">
            Pure Spa Institut
          </h1>
          <span className="text-sm text-text-muted">Réservation en ligne</span>
        </div>
      </header>
      <div className="flex-1 py-6">
        <BookingFunnel />
      </div>
    </main>
  );
}
