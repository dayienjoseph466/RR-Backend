import { Router } from "express";
import Event from "../models/Event.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
  const rows = await Event.find().sort({ start: 1 });
  res.json(rows);
});

router.post("/", requireAdmin, async (req, res) => {
  const doc = await Event.create(req.body);
  res.status(201).json(doc);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const doc = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(doc);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;
