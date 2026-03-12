require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
 
// Import routes and models
const authRoutes = require("./routes/auth");
const deviceRoutes = require("./routes/devices");
const Device = require("./models/Device");
const cropRoutes = require("./routes/crops");
 
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
 
// Middleware
app.use(cors({
  origin: ['https://karthikeyan-a-s.github.io', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));
app.use(express.json());
 
// API Endpoints
app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/crops", cropRoutes);
 
// Database Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas Cloud"))
  .catch((err) => console.error("❌ Atlas Connection Error:", err));
 
// ==========================================
// REAL-TIME WEBSOCKET ENGINE
// ==========================================
const liveDevices = new Map(); // deviceId -> { ws, ownerId }
const liveUsers = new Map();   // userId -> Set of WS connections
 
wss.on("connection", async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientType = url.searchParams.get("type");
 
  // --- RASPBERRY PI HANDLER ---
  if (clientType === "device") {
    const deviceId = url.searchParams.get("deviceId");
    const token = url.searchParams.get("token");
 
    // FIX: Wrap DB call in try/catch so a DB error doesn't silently kill the connection
    try {
      const device = await Device.findOne({ id: deviceId, token: token });
      if (!device) return ws.close(1008, "Unauthorized");
 
      liveDevices.set(deviceId, { ws, ownerId: device.ownerId?.toString() });
      console.log(`🚜 Device Connected: ${deviceId}`);
 
      ws.on("message", (message) => {
        // FIX: Wrap JSON.parse in try/catch — a malformed message was crashing the handler
        try {
          const data = JSON.parse(message);
          const ownerId = liveDevices.get(deviceId)?.ownerId;
          if (ownerId && liveUsers.has(ownerId)) {
            liveUsers.get(ownerId).forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({ type: "sensor_update", deviceId, data })
                );
              }
            });
          }
        } catch (e) {
          console.error(`❌ Malformed message from device ${deviceId}:`, e.message);
        }
      });
 
      ws.on("close", () => liveDevices.delete(deviceId));
    } catch (err) {
      console.error("❌ DB error during device WS auth:", err.message);
      ws.close(1011, "Server error");
    }
  }
 
  // --- FRONTEND HANDLER ---
  else if (clientType === "user") {
    const token = url.searchParams.get("token");
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
 
      if (!liveUsers.has(userId)) liveUsers.set(userId, new Set());
      liveUsers.get(userId).add(ws);
 
      ws.on("message", (message) => {
        // FIX: Wrap JSON.parse in try/catch — a malformed message was crashing the handler
        try {
          const command = JSON.parse(message);
          if (command.action === "send_command") {
            const target = liveDevices.get(command.targetDeviceId);
            if (target && target.ownerId === userId) {
              target.ws.send(JSON.stringify(command.payload));
            }
          }
        } catch (e) {
          console.error(`❌ Malformed message from user ${userId}:`, e.message);
        }
      });
 
      ws.on("close", () => {
        liveUsers.get(userId)?.delete(ws);
        if (liveUsers.get(userId)?.size === 0) liveUsers.delete(userId);
      });
    } catch (e) {
      ws.close(1008, "Invalid Token");
    }
  }
});
 
// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SmartIQ Cloud Engine running on port ${PORT}`);
});