const { Expense, Company, User, ExpenseApproval } = require("../models");
const { extractReceiptFromBuffer } = require("../OCR/extractReceipt");
const { findApplicableRule, createInitialApprovals, fallbackManagerOnly } = require("../services/approvalEngine");
const { sendExpenseSubmittedToEmployee, sendExpensePendingForApprover } = require("../utils/mailer");

const parseReceiptOcr = async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ success: false, message: "Receipt file (image or PDF) is required." });
    // Always use INR
    const data = await extractReceiptFromBuffer(req.file.buffer, req.file.mimetype, "INR");
    return res.status(200).json({ success: true, message: "OK", data });
  } catch (error) {
    console.error("parseReceiptOcr:", error);
    return res.status(500).json({ success: false, message: "Could not read receipt." });
  }
};

const listMyExpenses = async (req, res) => {
  try {
    const rows = await Expense.find({ submitted_by: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, message: "OK", data: { expenses: rows } });
  } catch (error) {
    console.error("listMyExpenses:", error);
    return res.status(500).json({ success: false, message: "Could not load expenses." });
  }
};

const submitExpense = async (req, res) => {
  try {
    const { amount, category, description, expense_date } = req.body;
    const userId = req.user._id;
    const companyId = req.user.company_id;

    // Validate required fields
    if (!amount || !category || !expense_date) {
      return res.status(400).json({ success: false, message: "Amount, category, and date are required." });
    }

    // Validate amount: must be a positive finite number
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive number." });
    }

    // req.file.path is the full Cloudinary HTTPS URL after upload
    const receipt_url = req.file ? req.file.path : null;

    const newExpense = await Expense.create({
      company_id: companyId, submitted_by: userId, amount: parsedAmount,
      currency_code: "INR", amount_in_company_currency: parsedAmount,
      category, description: description || "", expense_date, receipt_url, status: "pending", current_step: 1,
    });

    const employee = await User.findById(userId);
    const rule = await findApplicableRule(companyId, userId, category);
    if (rule) { await createInitialApprovals(newExpense, rule, employee); }
    else { await fallbackManagerOnly(newExpense, employee); }

    const freshExpense = await Expense.findById(newExpense._id).lean();
    const pendingApprovals = await ExpenseApproval.find({ expense_id: newExpense._id });

    try {
      await sendExpenseSubmittedToEmployee({ to: employee.email, employeeName: employee.name, expenseId: newExpense._id.toString(), category, amount: String(parsedAmount), currency: "INR" });
      const approverIds = [...new Set(pendingApprovals.map((p) => p.approver_id.toString()))];
      const approvers = await User.find({ _id: { $in: approverIds } });
      for (const a of approvers) {
        await sendExpensePendingForApprover({ to: a.email, approverName: a.name, submitterName: employee.name, expenseId: newExpense._id.toString(), category, amount: String(parsedAmount), currency: "INR" });
      }
    } catch (mailErr) { console.error("Expense notification emails:", mailErr.message); }

    res.status(201).json({ success: true, message: "Expense submitted successfully", data: { expense: freshExpense } });
  } catch (error) {
    console.error("Submit Expense Error:", error);
    res.status(500).json({ success: false, message: "Internal server error while submitting expense." });
  }
};

module.exports = { parseReceiptOcr, listMyExpenses, submitExpense };
