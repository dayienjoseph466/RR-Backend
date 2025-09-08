// time helpers and slot builder

export function toMinutes(str) {
  const m = String(str || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error("Bad time " + str);
  const h = Math.min(29, Math.max(0, Number(m[1])));  // allow 25:00 close
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return h * 60 + mm;
}

export function toTime(min) {
  const m = ((min % 1440) + 1440) % 1440;
  const h = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

/**
 * Build slot start times from opening to closing.
 * closing can be over 24 hours like 25:00 for one a.m. next day.
 * last start fits fully before closing.
 */
export function buildSlots(opening = "11:00", closing = "22:00", step = 30) {
  const start = toMinutes(opening);
  const end = toMinutes(closing);
  const s = Number(step) > 0 ? Number(step) : 30;

  if (end <= start) return [];

  const out = [];
  for (let t = start; t + s <= end; t += s) out.push(toTime(t));
  return out;
}
