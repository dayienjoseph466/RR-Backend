import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    mediaType: { type: String, enum: ["image", "video"], default: "image" },
    mediaUrl: { type: String, default: "" },
    posterUrl: { type: String, default: "" },
    desc: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Event = mongoose.model("Event", EventSchema);
export default Event;
