// routes/UserRouter.js
const express = require("express");
const router = express.Router();
const { createUser } = require("../controllers/UserController");
const ensureAuthenticated = require("../middlewares/Auth"); // Your existing auth middleware
const { ensureAdmin } = require("../middlewares/RoleMiddleware"); // The new admin check

// Route: POST /api/users
// Protected by: Authentication AND Admin Role check
router.post("/", ensureAuthenticated, ensureAdmin, createUser);

module.exports = router;
