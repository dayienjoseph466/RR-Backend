export function toMinutes(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}
export function toTime(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}
export function buildSlots(opening = "12:00", closing = "23:00", step = 30) {
  const start = toMinutes(opening);
  const end = toMinutes(closing);
  const out = [];
  for (let t = start; t + step <= end; t += step) out.push(toTime(t));
  return out;
}
