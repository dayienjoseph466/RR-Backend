import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import "dotenv/config";                    // load .env

import jwt from "jsonwebtoken";

import reservationsRoutes from "./reservations.js";
import { auth } from "./auth.js";

// admin routes
import adminMenuRoutes from "./routes/adminMenu.js";
import adminEventsRoutes from "./routes/adminEvents.js";

// models for public read endpoints
import MenuItem from "./models/MenuItem.js";
import Event from "./models/Event.js";

/* uploads (image/video) */
import multer from "multer";
import path from "path";
import fs from "fs";

const app = express();

/* CORS */
const allowList = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://paris-pub.vercel.app",
  "https://parispub1.vercel.app",
];
const corsOptions = {
  origin(origin, cb) {
    // allow same origin or tools like curl with no origin
    if (!origin) return cb(null, true);
    if (allowList.includes(origin) || /\.vercel\.app$/.test(origin)) {
      return cb(null, true);
    }
    return cb(new Error("CORS not allowed"), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

/* Serve and accept uploads */
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const ok = /^(image|video)\//.test(file.mimetype || "");
    if (ok) cb(null, true);
    else cb(new Error("Unsupported file type"));
  },
});

// protected upload endpoint (send Authorization: Bearer <token> from client)
app.post("/api/upload", auth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "no file" });
  const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ url });
});

/* Mount admin routers */
app.use("/api/admin/menu", adminMenuRoutes);
app.use("/api/admin/events", adminEventsRoutes);

/* Public read endpoints */
app.get("/api/menu", async (req, res) => {
  try {
    const { category } = req.query;
    const q = category ? { category } : {};
    const rows = await MenuItem.find(q).sort({ sortOrder: 1, name: 1 });
    res.json(rows);
  } catch (_err) {
    res.status(500).json({ message: "server error" });
  }
});

app.get("/api/events", async (_req, res) => {
  try {
    const rows = await Event.find({ active: true }).sort({ start: 1 });
  res.json(rows);
  } catch (_err) {
    res.status(500).json({ message: "server error" });
  }
});

/* Health check */
app.get("/", (_req, res) => res.send("API is running"));

/* Admin login */
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  const okUser = username === process.env.ADMIN_USER;
  const okPass = password === process.env.ADMIN_PASS;
  if (!okUser || !okPass) {
    return res.status(401).json({ message: "Bad credentials" });
  }
  const token = jwt.sign({ user: username }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });
  res.json({ token });
});

/* Auth check for ProtectedRoute */
app.get("/api/auth/me", auth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

/* Reservations routes */
app.use("/api", reservationsRoutes);

/* Basic error handler (multer / others) */
app.use((err, _req, res, _next) => {
  if (err?.message === "Unsupported file type") {
    return res.status(400).json({ message: err.message });
  }
  if (err?.name === "MulterError") {
    return res.status(400).json({ message: err.message });
  }
  console.error(err);
  return res.status(500).json({ message: "server error" });
});

const PORT = process.env.PORT || 5000;
const MONGO = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rr";

async function start() {
  await mongoose.connect(MONGO);
  app.listen(PORT, () => {
    console.log(`server on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
