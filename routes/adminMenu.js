import { Router } from "express";
import MenuItem from "../models/MenuItem.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
  const { category } = req.query;
  const q = category ? { category } : {};
  const items = await MenuItem.find(q).sort({ sortOrder: 1, name: 1 });
  res.json(items);
});

router.post("/", requireAdmin, async (req, res) => {
  const doc = await MenuItem.create(req.body);
  res.status(201).json(doc);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const doc = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(doc);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  await MenuItem.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;
