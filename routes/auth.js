const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Device = require("../models/Device");
const authenticateToken = require("../middleware/authenticateToken");

const router = express.Router();

// Function to send email via Brevo HTTP API (Bypasses Render's firewall)
const sendOtpEmail = async (userEmail, otpCode) => {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { 
          email: "smartiq.farm@gmail.com", // You can leave this as-is, or use your own
          name: "SmartIQ" 
        },
        to: [{ email: userEmail }],
        subject: "Your SmartIQ Verification Code",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 30px; background-color: #f2fafd; border-radius: 10px; max-width: 500px; margin: auto;">
            <h2 style="color: #0b6e8a; margin-top: 0;">🌱 Welcome to SmartIQ</h2>
            <p style="color: #4d7d92; font-size: 16px;">Your 6-digit verification code is:</p>
            <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #b8dcea;">
              <h1 style="letter-spacing: 6px; color: #0b6e8a; margin: 0; font-size: 32px;">${otpCode}</h1>
            </div>
            <p style="color: #4d7d92; font-size: 14px;">This code will expire in 10 minutes.</p>
          </div>
        `
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo API Error:", errorData);
      throw new Error("Failed to send email through API");
    }

    console.log(`✅ OTP successfully sent via Brevo API to ${userEmail}`);
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
};

// Helper to generate a 6-digit number
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// 1. REGISTER & SEND OTP
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });

    // Stop if user already exists and is fully verified
    if (user && user.isVerified)
      return res.status(400).json({ error: "Email already in use" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000; // Expires in 10 minutes

    if (user) {
      // If user exists but isn't verified yet, update their details
      user.password = hashedPassword;
      user.otp = otp;
      user.otpExpiry = otpExpiry;
    } else {
      // Create a brand new user
      user = new User({ email, password: hashedPassword, otp, otpExpiry });
    }
    await user.save();

    // 👉 FIX: Call the new API function instead of Nodemailer!
    await sendOtpEmail(email, otp);

    res.status(201).json({ message: "OTP sent to email. Please verify." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error while registering" });
  }
});

// 2. VERIFY REGISTRATION OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email, otp });

    if (!user || user.otpExpiry < Date.now())
      return res.status(400).json({ error: "Invalid or expired OTP" });

    user.isVerified = true;
    user.otp = undefined; // Clear the OTP out of the database for security
    user.otpExpiry = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: "Server error verifying OTP" });
  }
});

// 3. LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.isVerified)
      return res.status(403).json({ error: "Please verify your email first" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({ token, userId: user._id });
  } catch (err) {
    res.status(500).json({ error: "Server error during login" });
  }
});

// 4. FORGOT PASSWORD (SEND OTP)
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email, isVerified: true });
    if (!user) return res.status(404).json({ error: "User not found" });

    user.otp = generateOTP();
    user.otpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    // 👉 FIX: Call the new API function instead of Nodemailer!
    await sendOtpEmail(email, user.otp);

    res.json({ message: "Password reset OTP sent." });
  } catch (err) {
    res.status(500).json({ error: "Server error sending reset OTP" });
  }
});

// 5. RESET PASSWORD
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email, otp });

    if (!user || user.otpExpiry < Date.now())
      return res.status(400).json({ error: "Invalid or expired OTP" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ message: "Password reset successful. You can now login." });
  } catch (err) {
    res.status(500).json({ error: "Server error resetting password" });
  }
});

// DELETE ACCOUNT WITH PASSWORD VERIFICATION
router.delete("/delete-account", authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ error: "User not found" });

    // Verify password before proceeding
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res
        .status(401)
        .json({ error: "Incorrect password. Deletion cancelled." });

    // Unlink all devices owned by this user
    await Device.deleteMany({ ownerId: req.user.id });
    // await Device.updateMany({ ownerId: req.user.id }, { ownerId: null });

    // Delete the user
    await User.findByIdAndDelete(req.user.id);

    res.json({ message: "Account permanently deleted." });
  } catch (err) {
    res.status(500).json({ error: "Server error during deletion" });
  }
});

module.exports = router;