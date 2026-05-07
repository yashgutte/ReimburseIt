// routes/ExpenseRouter.js
const express = require("express");
const router = express.Router();
const {
  parseReceiptOcr,
  listMyExpenses,
  submitExpense,
} = require("../controllers/ExpenseController");
const ensureAuthenticated = require("../middlewares/Auth");
const upload = require("../models/fileUpload");
const uploadMemory = require("../models/fileUploadMemory");
const { createRateLimiter } = require("../middlewares/rateLimit");
const ocrLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyFn: (req) => `ocr:${req.user?._id || req.ip || "unknown"}`,
});

router.get("/mine", ensureAuthenticated, listMyExpenses);

router.post(
  "/parse-receipt",
  ensureAuthenticated,
  ocrLimiter,
  uploadMemory.single("receipt"),
  parseReceiptOcr,
);

router.post("/", ensureAuthenticated, upload.single("receipt"), submitExpense);

module.exports = router;
