const express = require("express");
const router = express.Router();
const CustomCrop = require("../models/CustomCrop");
const authenticateToken = require("../middleware/authenticateToken");

// GET all custom crops for the logged-in user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const crops = await CustomCrop.find({ ownerId: req.user.id });
    // toJSON virtuals (dripSpeed, surfaceSpeed) are included automatically
    res.json(crops);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching crops" });
  }
});

// POST a new custom crop
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      name,
      dripDuration,
      surfaceQuantity,
      surfaceDuration,
      dripSpeedLevel,
      surfaceSpeedLevel,
    } = req.body;

    const newCrop = new CustomCrop({
      ownerId: req.user.id,
      name,
      dripDuration,
      surfaceQuantity,
      surfaceDuration,
      // Fall back to level 2 (Moderate / Medium) if client omits them
      dripSpeedLevel:   dripSpeedLevel   ?? 2,
      surfaceSpeedLevel: surfaceSpeedLevel ?? 2,
    });

    await newCrop.save();
    res.status(201).json(newCrop);
  } catch (err) {
    res.status(500).json({ error: "Server error saving crop" });
  }
});

// PUT update an existing custom crop
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const {
      name,
      dripDuration,
      surfaceQuantity,
      surfaceDuration,
      dripSpeedLevel,
      surfaceSpeedLevel,
    } = req.body;

    const crop = await CustomCrop.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user.id },
      {
        name,
        dripDuration,
        surfaceQuantity,
        surfaceDuration,
        dripSpeedLevel,
        surfaceSpeedLevel,
      },
      { new: true, runValidators: true }
    );

    if (!crop) return res.status(404).json({ error: "Crop not found" });
    res.json(crop);
  } catch (err) {
    res.status(500).json({ error: "Server error updating crop" });
  }
});

// DELETE a custom crop
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const deleted = await CustomCrop.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user.id,
    });
    if (!deleted) return res.status(404).json({ error: "Crop not found" });
    res.json({ message: "Crop deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error deleting crop" });
  }
});

module.exports = router;