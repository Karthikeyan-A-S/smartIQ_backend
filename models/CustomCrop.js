const mongoose = require("mongoose");

const CustomCropSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true },

    // ── Drip ──────────────────────────────────────────────────────
    dripDuration: { type: Number, default: 30 },       // minutes

    // Speed level 1-3 maps to pump % (40 / 60 / 80).
    // This is the warm-up base speed used for the first 3 s in AUTO DRIP
    // before the ESP32 switches to its weather+salinity calculation.
    dripSpeedLevel: { type: Number, default: 2, min: 1, max: 3 },

    // ── Surface ───────────────────────────────────────────────────
    surfaceQuantity: { type: Number, default: 5.0 },   // litres
    surfaceDuration: { type: Number, default: 30 },    // minutes

    // Speed level 1-3 maps to pump % (40 / 70 / 100).
    // Used in MANUAL surface mode. AUTO surface always runs at 100%.
    surfaceSpeedLevel: { type: Number, default: 2, min: 1, max: 3 },
  },
  { timestamps: true }
);

// Convenience virtual: resolve dripSpeedLevel -> actual pump percentage
CustomCropSchema.virtual("dripSpeed").get(function () {
  const map = { 1: 40, 2: 60, 3: 80 };
  return map[this.dripSpeedLevel] ?? 60;
});

// Convenience virtual: resolve surfaceSpeedLevel -> actual pump percentage
CustomCropSchema.virtual("surfaceSpeed").get(function () {
  const map = { 1: 40, 2: 70, 3: 100 };
  return map[this.surfaceSpeedLevel] ?? 70;
});

CustomCropSchema.set("toJSON", { virtuals: true });
CustomCropSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("CustomCrop", CustomCropSchema);