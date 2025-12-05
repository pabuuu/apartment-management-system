import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { supabase } from "../supabase.js";

dotenv.config();

// ===============================
// Email Transporter
// ===============================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Helper to send plain text email
const sendEmailDirect = async (to, subject, text) => {
  await transporter.sendMail({
    from: `"Rangeles Management" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  });
};

// ===============================
// Get All Users
// ===============================
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// ===============================
// Get Users by Role
// ===============================
export const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const users = await User.find({ role }).select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users by role:", error);
    res.status(500).json({ message: "Failed to fetch users by role" });
  }
};

// ===============================
// Get single user by ID
// ===============================
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password"); // exclude password
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    console.error("getUserById error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ===============================
// Verify Admin
// ===============================
export const verifyAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.isVerified = true;
    await user.save();

    res.status(200).json({ success: true, message: "Admin verified successfully." });
  } catch (err) {
    console.error("verifyAdmin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ===============================
// Register User (Admin/Staff)
// ===============================
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, role = "admin", contactNumber } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already exists" });

    let validIdUrl, resumeUrl;

    // Upload Valid ID to 'validid' bucket
    if (req.files?.validId?.[0]) {
      const file = req.files.validId[0];
      const fileName = `validIds/${Date.now()}_${file.originalname}`;
      const { data, error } = await supabase.storage
        .from("validid") // NEW BUCKET
        .upload(fileName, file.buffer, { contentType: file.mimetype });
      if (error) throw error;
      validIdUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/validid/${fileName}`;
    }

    // Upload Resume to 'resume' bucket
    if (req.files?.resume?.[0]) {
      const file = req.files.resume[0];
      const fileName = `resumes/${Date.now()}_${file.originalname}`;
      const { data, error } = await supabase.storage
        .from("resume") // NEW BUCKET
        .upload(fileName, file.buffer, { contentType: file.mimetype });
      if (error) throw error;
      resumeUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/resume/${fileName}`;
    }

    const tempPassword = `${fullName.split(" ")[0]}${contactNumber.slice(-4)}`;
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = new User({
      fullName,
      email,
      password: hashedPassword,
      role,
      contactNumber,
      isTemporaryPassword: true,
      validId: validIdUrl || undefined,
      resume: resumeUrl || undefined,
    });

    await user.save();

    const setupToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "2d",
    });
    const frontendUrl = "https://rangeles.online";
    const setupLink = `${frontendUrl}/new-password?token=${setupToken}`;

    const subject = `Welcome to Rangeles Admin Portal`;
    const message = `
Hello ${fullName},

You have been registered as a ${role.toUpperCase()} in the Rangeles Admin Portal.

📧 Login Email: ${email}
🔑 Temporary Password: ${tempPassword}

Please log in using your temporary password and set a new one here:
${setupLink}

Regards,
Rangeles Management
`;

    await sendEmailDirect(email, subject, message);

    res.status(201).json({
      success: true,
      message:
        "User registered successfully. A welcome email with setup instructions has been sent.",
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Failed to register user" });
  }
};

// ===============================
// Forgot Password
// ===============================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Email not found." });
    }

    // Generate a secure token valid for 10 minutes
    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Always point to the live frontend URL
    const frontendUrl = "https://rangeles.online";
    const resetLink = `${frontendUrl}/reset-password-admin?token=${token}`;

    // HTML email content
    const html = `
      <p>Hello ${user.fullName},</p>
      <p>You requested a password reset for your Rangeles Admin account.</p>
      <p>This link is valid for 10 minutes:</p>
      <p><a href="${resetLink}" target="_blank">${resetLink}</a></p>
      <p>If this wasn’t you, ignore this email.</p>
      <p>— Rangeles Management</p>
    `;

    // Plain text fallback
    const text = `Hello ${user.fullName},\n\nYou requested a password reset for your Rangeles Admin account.\nReset your password here (valid 10 minutes): ${resetLink}\n\nIf this wasn’t you, ignore this email.\n\n— Rangeles Management`;

    // Send email
    await transporter.sendMail({
      from: `"Rangeles Management" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Request",
      html,
      text,
    });

    console.log(`📩 Reset link sent: ${resetLink}`);

    return res.json({
      success: true,
      message: "Password reset email sent successfully.",
    });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error sending reset email.",
    });
  }
};

// ===============================
// Reset Password
// ===============================
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword)
      return res
        .status(400)
        .json({ success: false, message: "Token and new password are required." });

    const passwordRegex =
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long, include 1 uppercase letter, 1 number, and 1 special character.",
      });
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpires: { $gt: Date.now() },
    });

    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token." });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    user.isTemporaryPassword = false;

    await user.save();

    return res.json({
      success: true,
      message: "Password updated successfully. You may now log in.",
    });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ===============================
// Upload Valid ID and Resume (Requirements Only)
// ===============================
export const uploadRequirements = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let validIdUrl, resumeUrl;

    // Helper function to sanitize file names for Supabase
    const sanitizeFileName = (name) => {
      return name
        .normalize("NFKD") // normalize unicode
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/\s+/g, "_") // replace spaces with underscores
        .replace(/[^a-zA-Z0-9._-]/g, ""); // remove unsafe characters
    };

    // Upload Valid ID
    if (req.files?.validId?.[0]) {
      const file = req.files.validId[0];
      const safeFileName = `validIds/${Date.now()}_${sanitizeFileName(file.originalname)}`;

      const { error } = await supabase.storage
        .from("validid")
        .upload(safeFileName, file.buffer, { contentType: file.mimetype });

      if (error) throw error;

      validIdUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/validid/${safeFileName}`;
    }

    // Upload Resume
    if (req.files?.resume?.[0]) {
      const file = req.files.resume[0];
      const safeFileName = `resumes/${Date.now()}_${sanitizeFileName(file.originalname)}`;

      const { error } = await supabase.storage
        .from("resume")
        .upload(safeFileName, file.buffer, { contentType: file.mimetype });

      if (error) throw error;

      resumeUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/resume/${safeFileName}`;
    }

    // Save URLs to user document
    user.validId = validIdUrl || user.validId;
    user.resume = resumeUrl || user.resume;
    await user.save();

    res.status(200).json({ message: "Requirements uploaded successfully." });
  } catch (err) {
    console.error("uploadRequirements error:", err);
    res.status(500).json({ message: "Failed to upload requirements" });
  }
};

// Get logged-in admin/staff profile
export const getMe = async (req, res) => {
  try {
    console.log("getMe called with req.user:", req.user);

    if (!req.user) {
      console.warn("No user attached to request");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { _id, fullName, email, role, contactNumber, isVerified, validId, resume } = req.user;

    console.log("Sending user data:", { _id, fullName, email, role, contactNumber, isVerified, validId, resume });

    res.status(200).json({
      success: true,
      data: { _id, fullName, email, role, contactNumber, isVerified, validId, resume },
    });
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ===============================
// Delete User
// ===============================
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    // Prevent deleting SUPERADMIN
    if (user.role === "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Superadmin accounts cannot be deleted.",
      });
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully.",
    });
  } catch (err) {
    console.error("deleteUser error:", err);
    return res.status(500).json({ success: false, message: "Server error deleting user." });
  }
};
