import { Settings } from "lucide-react";
import { ConfigurationClient } from "./configuration-client";

export default function AdminConfigurationPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-primary" />
        <h1 className="text-xl font-semibold text-text">Configuration</h1>
      </div>
      <ConfigurationClient />
    </div>
  );
}
