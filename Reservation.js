import mongoose from "mongoose";

const reservationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    partySize: { type: Number, min: 1, max: 20, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, required: true }  // HH:MM
  },
  { timestamps: true }
);

reservationSchema.index({ date: 1, time: 1 });

export default mongoose.model("Reservation", reservationSchema);
