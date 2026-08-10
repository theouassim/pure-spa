import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import Link from "next/link";
import Image from "next/image";
import { ConfirmationAdsTracking } from "@/components/ConfirmationAdsTracking";

export const metadata = {
  title: "Réservation confirmée — Pure Spa Institut",
};

interface Props {
  searchParams: Promise<{ session_id?: string; mode?: string; booking_id?: string }>;
}

export default async function ConfirmationPage({ searchParams }: Props) {
  const params = await searchParams;

  let startAt: Date | null = null;
  let adsProps: { eventKey: string; value: number; serviceName: string; paymentMethod: "online" | "onsite" } | null = null;

  if (params.mode === "onsite" && params.booking_id) {
    // Réservation sur place — récupérer le booking en base
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("start_at, montant, service_id")
      .eq("id", params.booking_id)
      .single();

    if (!booking) {
      redirect("/");
    }
    startAt = new Date(booking.start_at);

    const { data: svc } = await supabaseAdmin
      .from("services")
      .select("nom")
      .eq("id", booking.service_id)
      .single();

    adsProps = {
      eventKey: params.booking_id,
      value: booking.montant ?? 0,
      serviceName: svc?.nom ?? "",
      paymentMethod: "onsite",
    };
  } else if (params.session_id) {
    // Paiement en ligne — vérifier via Stripe
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(params.session_id);
    } catch {
      redirect("/");
    }

    if (session.payment_status !== "paid") {
      redirect("/");
    }

    startAt = session.metadata?.start_at ? new Date(session.metadata.start_at) : null;

    const serviceId = session.metadata?.service_id;
    let serviceName = "";
    if (serviceId) {
      const { data: svc } = await supabaseAdmin
        .from("services")
        .select("nom")
        .eq("id", serviceId)
        .single();
      serviceName = svc?.nom ?? "";
    }

    adsProps = {
      eventKey: params.session_id,
      value: Number(session.metadata?.montant_total ?? 0),
      serviceName,
      paymentMethod: "online",
    };
  } else {
    redirect("/");
  }

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-border bg-bg-card py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center">
          <Image src="/logo.png" alt="Pure SPA" width={140} height={42} />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-text mb-2">
            Réservation confirmée
          </h2>

          <p className="text-text-muted mb-6">
            Merci ! Votre rendez-vous est bien enregistré.
          </p>

          {startAt && (
            <div className="rounded-lg border border-border bg-bg-card p-4 mb-6 text-left">
              <p className="text-sm text-text-muted mb-1">Votre rendez-vous</p>
              <p className="font-medium text-text capitalize">
                {startAt.toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Europe/Paris",
                })}
              </p>
              <p className="text-sm text-text-muted">
                à{" "}
                {startAt.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Paris",
                })}
              </p>
            </div>
          )}

          <p className="text-sm text-text-muted mb-6">
            Un email de confirmation vous sera envoyé sous peu.
          </p>

          <Link
            href="/"
            className="inline-block rounded-full bg-primary px-6 py-2.5 text-sm text-white font-medium transition-colors hover:bg-primary-dark"
          >
            Réserver un autre soin
          </Link>
        </div>
      </div>
      {adsProps && (
        <ConfirmationAdsTracking
          eventKey={adsProps.eventKey}
          value={adsProps.value}
          serviceName={adsProps.serviceName}
          paymentMethod={adsProps.paymentMethod}
        />
      )}
    </main>
  );
}
