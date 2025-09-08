import mongoose from "mongoose";

const reservationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },

    partySize: { type: Number, min: 1, max: 20, required: true },

    date: { type: String, required: true },   // YYYY-MM-DD
    time: { type: String, required: true },   // HH:MM start time for this 30 min block

    tablesNeeded: { type: Number, required: true },

    // new field so Mongo can auto remove old rows
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

// lookups by day and time
reservationSchema.index({ date: 1, time: 1 });

// TTL index. Mongo removes docs when expiresAt passes
reservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Reservation", reservationSchema);
