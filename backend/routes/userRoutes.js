import express from "express";
import multer from "multer";
import {
  getUsers,
  getUsersByRole,
  registerUser,
  forgotPassword,
  resetPassword,
  getUserById,
  verifyAdmin,
  uploadRequirements,
  getMe,
  deleteUser
} from "../controllers/userController.js";
import { authMiddlewareUser } from "../middleware/authMiddlewareUser.js";

const router = express.Router();

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Fetch all users
router.get("/", getUsers);

// Fetch users by role (admin or staff)
router.get("/role/:role", getUsersByRole);

// Get current authenticated user ✅
router.get("/me", authMiddlewareUser, getMe);

// Fetch single user by ID ✅
router.get("/:id", getUserById);

// Verify admin ✅
router.patch("/:id/verify", verifyAdmin);

// Register new user (Admin/Staff) with optional validId + resume
router.post(
  "/register",
  upload.fields([
    { name: "validId", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  registerUser
);

// Delete user by ID ✅
router.delete("/:id", deleteUser);

// Upload requirements only (Valid ID + Resume)
router.post(
  "/upload-requirements",
  authMiddlewareUser, // ✅ Add this
  upload.fields([
    { name: "validId", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  uploadRequirements
);

// Forgot password — sends reset email
router.post("/forgot-password", forgotPassword);

// Reset password — updates password using token
router.post("/reset-password", resetPassword);

export default router;
