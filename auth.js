import express from "express";
import jwt from "jsonwebtoken";

export function auth(req, res, next) {
  const header = (req.headers.authorization || "").trim();
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

/* add this router so GET /api/auth/me returns 200 when the token is valid */
export const authRouter = express.Router();

authRouter.get("/api/auth/me", auth, (req, res) => {
  res.json({ ok: true, user: req.user });
});
