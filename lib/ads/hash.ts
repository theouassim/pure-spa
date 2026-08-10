import "server-only";

import { createHash } from "crypto";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0") && digits.length === 10) {
    return `+33${digits.slice(1)}`;
  }
  return `+33${digits}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashEmail(email: string): string {
  return sha256(normalizeEmail(email));
}

export function hashPhone(phone: string): string {
  return sha256(normalizePhone(phone));
}

export function hashName(name: string): string {
  return sha256(normalizeName(name));
}
