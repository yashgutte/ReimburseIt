const {
  login,
  getProfile,
  updateProfile,
  logout,
} = require("../controllers/AuthController.js");

const {
  loginValidation,
  updateProfileValidation,
} = require("../middlewares/AuthMiddleware");

const upload = require("../models/fileUpload");
const ensureAuthenticated = require("../middlewares/Auth");
const { createRateLimiter } = require("../middlewares/rateLimit");

const router = require("express").Router();
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `login:${req.ip || "unknown"}`,
});

// ─── Public routes ────────────────────────────────────────────────────────────
// Signup is intentionally removed — only admin (seeded) can create accounts.
// New users are created by admin via the invite flow (POST /api/admin/users/send-password).
router.post("/login", loginLimiter, loginValidation, login);

// ─── Protected routes ─────────────────────────────────────────────────────────
router.get("/profile", ensureAuthenticated, getProfile);

router.put(
  "/profile",
  ensureAuthenticated,
  upload.single("profilePicture"),
  updateProfileValidation,
  updateProfile
);

router.post("/logout", ensureAuthenticated, logout);

// Token verification — used by AuthProvider on page load
router.get("/verify", ensureAuthenticated, (req, res) => {
  res.json({
    message: "Token is valid",
    success: true,
    user: req.user,
  });
});

module.exports = router;
