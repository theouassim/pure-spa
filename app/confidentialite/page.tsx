import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Politique de confidentialité — Pure Spa Institut",
};

export default function ConfidentialitePage() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-border bg-bg-card py-4 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="Pure SPA" width={140} height={42} priority />
          </Link>
        </div>
      </header>

      <div className="flex-1 py-10 px-4">
        <article className="max-w-3xl mx-auto prose prose-sm text-text">
          <h1 className="text-2xl font-semibold text-text mb-6">
            Politique de confidentialité
          </h1>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-text mb-2">Responsable du traitement</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Pure Spa Institut, dont le site de réservation est accessible à l&apos;adresse
              booking.purespainstitut.com, est responsable du traitement des données personnelles
              collectées via ce site.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-text mb-2">Données collectées</h2>
            <p className="text-sm text-text-muted leading-relaxed mb-2">
              Lors d&apos;une réservation, nous collectons :
            </p>
            <ul className="text-sm text-text-muted space-y-1 list-disc pl-5">
              <li>Nom et prénom</li>
              <li>Adresse email</li>
              <li>Numéro de téléphone</li>
              <li>Données de paiement (traitées par Stripe, nous ne stockons pas vos coordonnées bancaires)</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-text mb-2">Finalité du traitement</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Vos données sont utilisées exclusivement pour la gestion de vos réservations,
              l&apos;envoi de confirmations et rappels, et la facturation.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-text mb-2">Cookies et traceurs</h2>
            <p className="text-sm text-text-muted leading-relaxed mb-2">
              Ce site utilise :
            </p>
            <ul className="text-sm text-text-muted space-y-1 list-disc pl-5">
              <li>
                <strong>Cookies essentiels</strong> : nécessaires au fonctionnement du site (session, consentement).
                Toujours actifs.
              </li>
              <li>
                <strong>Cookies analytiques</strong> : mesure d&apos;audience via Google Analytics.
                Activés uniquement après votre consentement.
              </li>
              <li>
                <strong>Cookies marketing</strong> : suivi publicitaire (Meta Pixel).
                Activés uniquement après votre consentement.
              </li>
            </ul>
            <p className="text-sm text-text-muted leading-relaxed mt-2">
              Vous pouvez modifier vos préférences à tout moment en supprimant vos cookies
              ou en réinitialisant votre navigateur.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-text mb-2">Durée de conservation</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Vos données personnelles sont conservées pendant la durée nécessaire à la gestion
              de la relation client, puis archivées conformément aux obligations légales
              (3 ans après le dernier contact).
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-text mb-2">Vos droits</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification,
              de suppression, de limitation et de portabilité de vos données. Pour exercer
              ces droits, contactez-nous à : contact@purespainstitut.com
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold text-text mb-2">Hébergement</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Ce site est hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA.
              Les données sont stockées via Supabase (infrastructure AWS, région Europe).
            </p>
          </section>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-text-muted">
              Dernière mise à jour : juillet 2026
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
