const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");
const Device = require("../models/Device");
const authenticateToken = require("../middleware/authenticateToken");

const router = express.Router();

// Email Transporter Setup - This uses the .env variables you just created!
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS, // Your App Password
  },
  // THE MAGIC FIX: Forces Nodemailer to use IPv4 instead of IPv6
  family: 4
});

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

    // Send a professional-looking, spam-resistant email
    await transporter.sendMail({
      from: `"🌱 SmartIQ Security" <${process.env.EMAIL_USER}>`, // Adds a nice sender name instead of just the email address
      to: email,
      subject: "SmartIQ - Verify Your Account",
      text: `Welcome to SmartIQ! Your verification OTP is: ${otp}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #0b6e8a; border-bottom: 2px solid #edf6fb; padding-bottom: 10px;">🌱 SmartIQ Cloud</h2>
          <p style="color: #334155; font-size: 16px;">Hello,</p>
          <p style="color: #334155; font-size: 16px;">Please use the verification code below to complete your registration. This code will expire in exactly 10 minutes.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-radius: 8px; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">${otp}</span>
          </div>
          
          <p style="color: #64748b; font-size: 14px;">If you did not request this email, please ignore it. Your account is safe.</p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 30px;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">SmartIQ Agricultural Analytics Dashboard</p>
        </div>
      `,
    });

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

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "SmartIQ - Password Reset OTP",
      text: `Your password reset OTP is: ${user.otp}. It expires in 10 minutes.`,
    });

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
    await Device.updateMany({ ownerId: req.user.id }, { ownerId: null });

    // Delete the user
    await User.findByIdAndDelete(req.user.id);

    res.json({ message: "Account permanently deleted." });
  } catch (err) {
    res.status(500).json({ error: "Server error during deletion" });
  }
});

module.exports = router;
