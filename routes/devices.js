const express = require('express');
const Device = require('../models/Device');
const authenticateToken = require('../middleware/authenticateToken'); 

const router = express.Router();

// Claim a Raspberry Pi for a user
router.post('/claim', authenticateToken, async (req, res) => {
  try {
    const { deviceId, deviceToken } = req.body;
    const device = await Device.findOne({ id: deviceId, token: deviceToken });
    
    if (!device) return res.status(404).json({ error: 'Device not found or invalid token' });
    if (device.ownerId) return res.status(400).json({ error: 'Device already claimed' });

    device.ownerId = req.user.id; 
    await device.save();
    res.json({ message: 'Device claimed successfully', device });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's devices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const devices = await Device.find({ ownerId: req.user.id });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;