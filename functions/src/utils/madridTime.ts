export const MADRID_TIMEZONE = "Europe/Madrid";
const OUTBOUND_CALL_BUSINESS_START_HOUR = 9;
const OUTBOUND_CALL_BUSINESS_END_HOUR = 22;

type MadridTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const madridPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: MADRID_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

export function getMadridTimeParts(date: Date): MadridTimeParts {
  const map: Record<string, string> = {};
  for (const part of madridPartsFormatter.formatToParts(date)) {
    if (part.type === "literal") continue;
    map[part.type] = part.value;
  }
  const weekdayRaw = map.weekday || "";
  const weekday = weekdayRaw === "Mon" ? 1 :
    weekdayRaw === "Tue" ? 2 :
      weekdayRaw === "Wed" ? 3 :
        weekdayRaw === "Thu" ? 4 :
          weekdayRaw === "Fri" ? 5 :
            weekdayRaw === "Sat" ? 6 : 7;
  return {
    year: Number(map.year || 0),
    month: Number(map.month || 0),
    day: Number(map.day || 0),
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0),
    weekday,
  };
}

export function isMadridBusinessSlot(date: Date): boolean {
  const p = getMadridTimeParts(date);
  const isWeekday = p.weekday >= 1 && p.weekday <= 5;
  const inHours = p.hour >= OUTBOUND_CALL_BUSINESS_START_HOUR && p.hour < OUTBOUND_CALL_BUSINESS_END_HOUR;
  return isWeekday && inHours;
}

export function alignToMadridBusinessSlot(date: Date): Date {
  const next = new Date(date.getTime());
  for (let i = 0; i < 60 * 24 * 10; i += 1) {
    if (isMadridBusinessSlot(next)) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }
  return next;
}

export function nextBusinessDaySameTimeFromReference(reference: Date): Date {
  const ref = getMadridTimeParts(reference);
  const candidate = new Date(reference.getTime() + 24 * 60 * 60 * 1000);
  for (let i = 0; i < 60 * 24 * 10; i += 1) {
    const p = getMadridTimeParts(candidate);
    if (
      p.weekday >= 1 &&
      p.weekday <= 5 &&
      p.hour === ref.hour &&
      p.minute === ref.minute &&
      p.hour >= OUTBOUND_CALL_BUSINESS_START_HOUR &&
      p.hour < OUTBOUND_CALL_BUSINESS_END_HOUR
    ) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return alignToMadridBusinessSlot(candidate);
}
