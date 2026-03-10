const express = require("express");
const router = express.Router();
const CustomCrop = require("../models/CustomCrop");
const authenticateToken = require("../middleware/authenticateToken");

// GET all custom crops for the logged-in user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const crops = await CustomCrop.find({ ownerId: req.user.id });
    res.json(crops);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching crops" });
  }
});

// POST a new custom crop
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { name, dripDuration, surfaceQuantity, surfaceDuration } = req.body;

    const newCrop = new CustomCrop({
      ownerId: req.user.id,
      name,
      dripDuration,
      surfaceQuantity,
      surfaceDuration,
    });

    await newCrop.save();
    res.status(201).json(newCrop);
  } catch (err) {
    res.status(500).json({ error: "Server error saving crop" });
  }
});

module.exports = router;
