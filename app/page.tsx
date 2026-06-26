import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-semibold text-primary mb-4 tracking-tight">
          Pure Spa Institut
        </h1>
        <p className="text-text-muted mb-8">
          Réservez votre soin en ligne en quelques clics.
        </p>
        <Link
          href="/reserver"
          className="inline-block rounded-full bg-primary px-8 py-3 text-white font-medium transition-colors hover:bg-primary-dark"
        >
          Réserver un soin
        </Link>
      </div>
    </main>
  );
}
