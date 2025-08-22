import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

import reservationsRoutes from "./reservations.js";

dotenv.config();

const app = express();

// ✅ Update CORS to allow local dev + Vercel frontend
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://paris-pub.vercel.app" // your Vercel frontend
  ],
  credentials: false
}));

app.use(express.json());

// health check
app.get("/", (req, res) => res.send("API is running"));

// admin login inline to avoid path issues
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  const okUser = username === process.env.ADMIN_USER;
  const okPass = password === process.env.ADMIN_PASS;
  if (!okUser || !okPass) {
    return res.status(401).json({ message: "Bad credentials" });
  }
  const token = jwt.sign({ user: username }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.json({ token });
});

// reservations routes
app.use("/api", reservationsRoutes);

const PORT = process.env.PORT || 5000;

async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  app.listen(PORT, () => {
    console.log(`server on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});
