const express = require("express");
const crypto = require("crypto"); // <-- Required to generate unique Device IDs
const Device = require("../models/Device");
const authenticateToken = require("../middleware/authenticateToken");

const router = express.Router();

// CREATE A BRAND NEW DEVICE FROM DASHBOARD
router.post("/create", authenticateToken, async (req, res) => {
  try {
    const { name, token, thinkspeakChannel, thinkspeakReadKey, thinkspeakWriteKey } = req.body;

    // Generate a unique 8-character hex ID (e.g., PI_A1B2C3D4)
    const newDeviceId = "IQ_" + crypto.randomBytes(4).toString("hex").toUpperCase();

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

// CLAIM AN EXISTING RASPBERRY PI
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
// UPDATE DEVICE PARAMETERS
router.put("/update", authenticateToken, async (req, res) => {
  try {
    const { deviceId, name, thinkspeakChannel, thinkspeakReadKey, thinkspeakWriteKey } = req.body;
    
    // Find the device to ensure the user actually owns it before editing
    const device = await Device.findOne({ id: deviceId, ownerId: req.user.id });

    if (!device) return res.status(404).json({ error: "Device not found or not owned by you." });

    // Update fields if they were provided in the request
    if (name !== undefined) device.name = name;
    if (token !== undefined) device.token = token;
    if (thinkspeakChannel !== undefined) device.thinkspeakChannel = thinkspeakChannel;
    if (thinkspeakReadKey !== undefined) device.thinkspeakReadKey = thinkspeakReadKey;
    if (thinkspeakWriteKey !== undefined) device.thinkspeakWriteKey = thinkspeakWriteKey;

    await device.save();
    res.json({ message: "Device updated successfully", device });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: "Server error while updating device." });
  }
});

// PERMANENTLY DELETE DEVICE FROM DATABASE
router.delete("/delete", authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.body;
    
    // Find and permanently remove the document from the database
    const device = await Device.findOneAndDelete({ id: deviceId, ownerId: req.user.id });

    if (!device) return res.status(404).json({ error: "Device not found or not owned by you." });

    res.json({ message: "Device permanently deleted." });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Server error while deleting device." });
  }
});

// FETCH PI CONFIGURATION
// The Raspberry Pi calls this on boot to get its ThingSpeak key
router.post("/pi-config", async (req, res) => {
  try {
    const { deviceId, token } = req.body;
    
    // Authenticate the hardware using its ID and Security Token
    const device = await Device.findOne({ id: deviceId, token: token });
    
    if (!device) {
      return res.status(401).json({ error: "Hardware Unauthorized. Invalid ID or Token." });
    }

    // Send back the configuration
    res.json({
      thinkspeakWriteKey: device.thinkspeakWriteKey || "",
      name: device.name
    });

  } catch (err) {
    console.error("Config fetch error:", err);
    res.status(500).json({ error: "Server error fetching Pi config." });
  }
});

// GET USER'S DEVICES
router.get("/", authenticateToken, async (req, res) => {
  try {
    const devices = await Device.find({ ownerId: req.user.id });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;