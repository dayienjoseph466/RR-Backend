import express from "express";
import Reservation from "./Reservation.js";
import { buildSlots } from "./slots.js";
import { auth } from "./auth.js";
import nodemailer from "nodemailer";

const router = express.Router();

/* helpers */
function okDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
function normTime(s) {
  const m = String(s || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}
function todayLocalISO() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}
function isPastDate(iso) {
  return !okDate(iso) || iso < todayLocalISO();
}
// new rule. must book at least one day before
function isTooSoon(iso) {
  const today = todayLocalISO();
  return iso <= today; // block today and anything earlier
}
function ceilDiv(a, b) {
  return Math.floor((a + b - 1) / b);
}
function toMin(s) { const [h, m] = s.split(":").map(Number); return h * 60 + m; }
function addMin(hhmm, step) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + step;
  const hh = String(Math.floor((t % 1440) / 60)).padStart(2, "0");
  const mm = String(t % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
function dowFromISO(iso) { return new Date(iso + "T00:00:00").getDay(); }

// compute the time when Mongo should delete this reservation
// example if date is 2025-09-15 it will expire at local midnight on 2025-09-18
function expiresAtFromISO(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, m - 1, d + 3, 0, 0, 0, 0);
}

/* weekly hours */
const WEEKLY_HOURS = {
  0: { open: "11:00", close: "20:00" }, // sun
  1: null,                               // mon closed
  2: null,                               // tue closed
  3: { open: "11:00", close: "22:00" },  // wed
  4: { open: "11:00", close: "22:00" },  // thu
  5: { open: "11:00", close: "25:00" },  // fri
  6: { open: "11:00", close: "25:00" }   // sat
};
function dayRule(iso) {
  const r = WEEKLY_HOURS[dowFromISO(iso)];
  if (!r) return { closed: true };
  return { closed: false, open: r.open, close: r.close };
}

/* settings */
function settings() {
  return {
    step: Number(process.env.SLOT_MINUTES || 30),
    tablesTotal: Number(process.env.TABLES_TOTAL || 10),
    tableCapacity: Number(process.env.TABLE_CAPACITY || 4),
    maxParty: Number(process.env.MAX_PARTY || 20),
    restaurantName: process.env.RESTAURANT_NAME || "Paris Pub"
  };
}

/* mailer */
function mailer() {
  if (!process.env.MAIL_USER) return null;
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: false,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
  });
}

/* availability. respects closed days and advance notice rule */
router.get("/availability", async (req, res) => {
  const { date } = req.query;
  const partySize = Number(req.query.partySize || 1);
  const durationSlots = Math.max(1, Math.min(8, Number(req.query.durationSlots || 1)));
  const S = settings();

  if (isTooSoon(date)) return res.json({ slots: [] }); // new rule
  if (isPastDate(date)) return res.json({ slots: [] });
  if (partySize < 1 || partySize > S.maxParty) return res.json({ slots: [] });

  const rule = dayRule(date);
  if (rule.closed) return res.json({ slots: [] });

  const need = ceilDiv(partySize, S.tableCapacity);
  const all = buildSlots(rule.open, rule.close, S.step);

  const day = await Reservation.find({ date }).select("time tablesNeeded").lean();
  const usedByTime = new Map();
  for (const r of day) {
    const t = normTime(r.time);
    if (!t) continue;
    usedByTime.set(t, (usedByTime.get(t) || 0) + (r.tablesNeeded || 0));
  }

  function windowFits(start) {
    let t = start;
    for (let i = 0; i < durationSlots; i++) {
      if (!all.includes(t)) return false;
      const used = usedByTime.get(t) || 0;
      if (used + need > S.tablesTotal) return false;
      t = addMin(t, S.step);
    }
    return true;
  }

  const open = all.filter(windowFits);
  res.json({ slots: open });
});

/* create reservation. also sets TTL delete time */
router.post("/reservations", async (req, res) => {
  const { name, email, phone, date } = req.body || {};
  const time = normTime(req.body?.time);
  const partySize = Number(req.body?.partySize || 0);
  const durationSlots = Math.max(1, Math.min(8, Number(req.body?.durationSlots || 1)));
  const S = settings();

  if (!name || !email || !phone) return res.status(400).json({ message: "Missing fields" });
  if (!time || isPastDate(date)) return res.status(400).json({ message: "Bad date or time" });
  if (isTooSoon(date)) return res.status(400).json({ message: "Bookings must be made at least one day in advance" });
  if (partySize < 1 || partySize > S.maxParty) return res.status(400).json({ message: "Bad party size" });

  const rule = dayRule(date);
  if (rule.closed) return res.status(400).json({ message: "Closed on this day" });

  const all = buildSlots(rule.open, rule.close, S.step);
  const windowTimes = [];
  let t = time;
  for (let i = 0; i < durationSlots; i++) {
    if (!all.includes(t)) return res.status(400).json({ message: "Time outside opening hours" });
    windowTimes.push(t);
    t = addMin(t, S.step);
  }

  const need = ceilDiv(partySize, S.tableCapacity);

  for (const tt of windowTimes) {
    const existing = await Reservation.find({ date, time: tt }).select("tablesNeeded").lean();
    const used = existing.reduce((sum, r) => sum + (r.tablesNeeded || 0), 0);
    if (used + need > S.tablesTotal) {
      return res.status(409).json({ message: "Slot full" });
    }
  }

  const expiresAt = expiresAtFromISO(date);
  const docs = windowTimes.map(tt => ({
    name, email, phone,
    partySize,
    date,
    time: tt,
    tablesNeeded: need,
    expiresAt
  }));

  const created = await Reservation.insertMany(docs);

  try {
    const tx = mailer();
    if (tx) {
      const startLabel = time;
      const endLabel = addMin(time, S.step * durationSlots);
      await tx.sendMail({
        from: process.env.FROM_EMAIL,
        to: email,
        subject: `Your reservation at ${S.restaurantName}`,
        text: `Hi ${name}, your table is booked on ${date} from ${startLabel} to ${endLabel} for ${partySize} people.`
      });
    }
  } catch {
    // ignore mail errors
  }

  res.status(201).json({ ok: true, count: created.length });
});

/* admin list */
router.get("/reservations", auth, async (req, res) => {
  const { date } = req.query;
  const query = date ? { date } : {};
  const list = await Reservation.find(query).sort({ date: 1, time: 1 }).lean();
  res.json(list);
});

/* admin delete */
router.delete("/reservations/:id", auth, async (req, res) => {
  await Reservation.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;
