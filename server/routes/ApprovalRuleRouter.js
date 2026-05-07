// routes/ApprovalRuleRouter.js
const express = require("express");
const router = express.Router();
const { createRule, getCompanyRules } = require("../controllers/ApprovalRuleController");
const ensureAuthenticated = require("../middleware/Auth");
const { ensureAdmin } = require("../middleware/RoleMiddleware"); 

// Route: POST /api/rules -> Create a new rule (Admin only)
router.post("/", ensureAuthenticated, ensureAdmin, createRule);

// Route: GET /api/rules -> View all rules for the company (Admin only)
router.post("/", ensureAuthenticated, ensureAdmin, getCompanyRules);

module.exports = router;