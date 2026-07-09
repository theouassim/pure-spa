import { BarChart3 } from "lucide-react";
import { AnalyticsClient } from "./analytics-client";

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BarChart3 size={24} className="text-primary" />
        <h1 className="text-xl font-semibold text-text">Analytics — Tunnel de réservation</h1>
      </div>
      <AnalyticsClient />
    </div>
  );
}
