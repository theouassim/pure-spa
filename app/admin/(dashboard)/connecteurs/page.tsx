import { Plug } from "lucide-react";
import { ConnecteursClient } from "./connecteurs-client";

export default function ConnecteursPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Plug size={24} className="text-primary" />
        <h1 className="text-xl font-semibold text-text">Connecteurs</h1>
      </div>
      <p className="text-sm text-text-muted">
        Connectez vos outils de tracking pour mesurer l&apos;audience et les conversions de votre site.
        Les scripts ne se chargent qu&apos;après consentement des visiteurs (RGPD).
      </p>
      <ConnecteursClient />
    </div>
  );
}
