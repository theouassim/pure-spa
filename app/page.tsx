import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <Image src="/logo.png" alt="Pure SPA — Hair Spa Institut" width={220} height={66} className="mx-auto mb-6" priority />
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
