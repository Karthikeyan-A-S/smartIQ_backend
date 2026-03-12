const express = require("express");
const crypto = require("crypto"); // <-- Required to generate unique Device IDs
const Device = require("../models/Device");
const authenticateToken = require("../middleware/authenticateToken");

const router = express.Router();

// 1. CREATE A BRAND NEW DEVICE FROM DASHBOARD
router.post("/create", authenticateToken, async (req, res) => {
  try {
    const { name, token, thinkspeakChannel, thinkspeakReadKey, thinkspeakWriteKey } = req.body;

    // Generate a unique 8-character hex ID (e.g., PI_A1B2C3D4)
    const newDeviceId = "PI_" + crypto.randomBytes(4).toString("hex").toUpperCase();

    const newDevice = new Device({
      id: newDeviceId, 
      token: token,
      name: name || "Smart Node",
      ownerId: req.user.id, // Instantly link it to the user who clicked "Create"
      thinkspeakChannel: thinkspeakChannel || "",
      thinkspeakReadKey: thinkspeakReadKey || "",
      thinkspeakWriteKey: thinkspeakWriteKey || ""
    });

    await newDevice.save();

    // Return the generated ID so the frontend can display it
    res.status(201).json({ 
      message: "Device created successfully", 
      device: newDevice 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error creating device" });
  }
});

// 2. CLAIM AN EXISTING RASPBERRY PI
router.post("/claim", authenticateToken, async (req, res) => {
  try {
    const { deviceId, deviceToken } = req.body;
    const device = await Device.findOne({ id: deviceId, token: deviceToken });

    if (!device) return res.status(404).json({ error: "Device not found or invalid token" });
    if (device.ownerId) return res.status(400).json({ error: "Device already claimed" });

    device.ownerId = req.user.id;
    await device.save();
    res.json({ message: "Device claimed successfully", device });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 3. UNLINK / DELETE DEVICE FROM ACCOUNT
router.post("/unlink", authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.body;
    const device = await Device.findOne({ id: deviceId, ownerId: req.user.id });
    
    if (!device) return res.status(404).json({ error: "Device not found or not owned by you." });

    device.ownerId = null;
    await device.save();
    res.json({ message: "Device deleted from your account." });
  } catch (err) {
    res.status(500).json({ error: "Server error while deleting device." });
  }
});

// 4. GET USER'S DEVICES
router.get("/", authenticateToken, async (req, res) => {
  try {
    const devices = await Device.find({ ownerId: req.user.id });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;