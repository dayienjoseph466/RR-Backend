import mongoose from "mongoose";

const MenuItemSchema = new mongoose.Schema(
  {
    category: { type: String, enum: ["appetizers", "mains", "beverages", "desserts"], required: true },
    name: { type: String, required: true },
    desc: { type: String, default: "" },
    price: { type: Number, required: true },
    imageUrl: { type: String, default: "" },
    available: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const MenuItem = mongoose.model("MenuItem", MenuItemSchema);
export default MenuItem;
