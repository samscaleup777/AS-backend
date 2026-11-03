/** Date strings must be real calendar dates in YYYY-MM-DD format. */
export function isValidBookingDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Accepts 24-hour HH:mm strings and requires a positive time window. */
export function isValidTimeRange(startTime: string, endTime: string): boolean {
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  return validTime(startTime) && validTime(endTime) && startTime < endTime;
}

/** Half-open interval comparison: adjacent bookings do not overlap. */
export function overlaps(
  newStart: string,
  newEnd: string,
  existingStart: string,
  existingEnd: string,
): boolean {
  return newStart < existingEnd && newEnd > existingStart;
}

export function calculateBookingHours(startTime: string, endTime: string): number {
  if (!isValidTimeRange(startTime, endTime)) {
    throw new RangeError("A valid increasing 24-hour booking time range is required.");
  }
  const [startHourText, startMinuteText] = startTime.split(":");
  const [endHourText, endMinuteText] = endTime.split(":");
  const startMinutes = Number(startHourText) * 60 + Number(startMinuteText);
  const endMinutes = Number(endHourText) * 60 + Number(endMinuteText);
  return Number(((endMinutes - startMinutes) / 60).toFixed(2));
}

export function calculateBookingTotal(hours: number, hourlyRate: number, securityDeposit: number): number {
  return Number((hours * hourlyRate + securityDeposit).toFixed(2));
}