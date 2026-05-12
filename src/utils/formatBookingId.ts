export function formatBookingId(
  date: string,
  equipmentId: string | number,
  timeSlotId: string | number
): string {
  return `${date}-${equipmentId}-${timeSlotId}`;
}
