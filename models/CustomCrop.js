const mongoose = require("mongoose");

const CustomCropSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: { type: String, required: true },
  dripDuration: { type: Number, required: true },
  surfaceQuantity: { type: Number, required: true },
  surfaceDuration: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CustomCrop", CustomCropSchema);
