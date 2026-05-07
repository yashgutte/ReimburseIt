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

router.get("/mine", ensureAuthenticated, listMyExpenses);

// Public: OCR only — no JWT (client sends companyCurrency in multipart body).
router.post("/parse-receipt", uploadMemory.single("receipt"), parseReceiptOcr);

router.post("/", ensureAuthenticated, upload.single("receipt"), submitExpense);

module.exports = router;
