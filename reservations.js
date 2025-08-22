import express from "express";
import Reservation from "./Reservation.js";
import { buildSlots } from "./slots.js";
import { auth } from "./auth.js";
import nodemailer from "nodemailer";

const router = express.Router();

function okDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
function okTime(s) { return /^\d{2}:\d{2}$/.test(s); }

// local today as YYYY-MM-DD, so plain string compare works
function todayLocalISO() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}
function isPastDate(yyyy_mm_dd) {
  if (!okDate(yyyy_mm_dd)) return true;
  return yyyy_mm_dd < todayLocalISO();
}

function settings() {
  return {
    opening: process.env.OPENING_TIME || "9:00",
    closing: process.env.CLOSING_TIME || "23:30",
    step: Number(process.env.SLOT_MINUTES || 30),
    tables: Number(process.env.TABLES || 20),
    maxParty: Number(process.env.MAX_PARTY || 8)
  };
}

function mailer() {
  if (!process.env.MAIL_USER) return null;
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: false,
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
  });
}

// get free time slots
router.get("/availability", async (req, res) => {
  const { date, partySize } = req.query;
  const S = settings();

  if (!okDate(date)) return res.json({ slots: [] });
  // new rule. no slots for past dates
  if (isPastDate(date)) return res.json({ slots: [] });

  const p = Number(partySize || 1);
  if (p < 1 || p > S.maxParty) return res.json({ slots: [] });

  const all = buildSlots(S.opening, S.closing, S.step);
  const reserved = await Reservation.find({ date }).lean();
  const countByTime = reserved.reduce((a, r) => {
    a[r.time] = (a[r.time] || 0) + 1;
    return a;
  }, {});
  const open = all.filter(t => (countByTime[t] || 0) < S.tables);
  res.json({ slots: open });
});

// create a reservation
router.post("/reservations", async (req, res) => {
  const { name, email, phone, partySize, date, time } = req.body || {};
  const S = settings();

  if (!name || !email || !phone) return res.status(400).json({ message: "Missing fields" });
  if (!okDate(date) || !okTime(time)) return res.status(400).json({ message: "Bad date or time" });
  // new rule. cannot book a date in the past
  if (isPastDate(date)) return res.status(400).json({ message: "Date must be today or later" });
  if (partySize < 1 || partySize > S.maxParty) return res.status(400).json({ message: "Bad party size" });

  const count = await Reservation.countDocuments({ date, time });
  if (count >= S.tables) return res.status(409).json({ message: "Slot full" });

  const doc = await Reservation.create({ name, email, phone, partySize, date, time });

  try {
    const tx = mailer();
    if (tx) {
      await tx.sendMail({
        from: process.env.FROM_EMAIL,
        to: email,
        subject: `Your reservation at ${process.env.RESTAURANT_NAME}`,
        text: `Hi ${name}, your table is booked for ${date} at ${time} for ${partySize} people. See you soon.`
      });
    }
  } catch {
    // ignore mail errors for now
  }

  res.status(201).json(doc);
});

// admin list
router.get("/reservations", auth, async (req, res) => {
  const { date } = req.query;
  const query = date ? { date } : {};
  const list = await Reservation.find(query).sort({ date: 1, time: 1 }).lean();
  res.json(list);
});

// admin delete
router.delete("/reservations/:id", auth, async (req, res) => {
  await Reservation.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;
