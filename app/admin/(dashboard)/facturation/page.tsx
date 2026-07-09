import { Receipt } from "lucide-react";
import { FacturationClient } from "./facturation-client";

export default function AdminFacturationPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Receipt size={24} className="text-primary" />
        <h1 className="text-xl font-semibold text-text">Facturation</h1>
      </div>
      <FacturationClient />
    </div>
  );
}
