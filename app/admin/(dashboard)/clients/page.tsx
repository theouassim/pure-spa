import { Users } from "lucide-react";
import { ClientsClient } from "./clients-client";

export default function AdminClientsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Users size={24} className="text-primary" />
        <h1 className="text-xl font-semibold text-text">Clients</h1>
      </div>
      <ClientsClient />
    </div>
  );
}
