export function bookingEventId(eventKey: string): string {
  return `booking_${eventKey}`;
}

export function paymentEventId(eventKey: string): string {
  return `payment_${eventKey}`;
}

export function funnelEventId(): string {
  return crypto.randomUUID();
}
