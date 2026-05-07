const { mongoose } = require("./db");

const expenseSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },
    submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    amount: { type: Number, default: 0 },
    currency_code: { type: String, default: "USD" },
    amount_in_company_currency: { type: Number, default: 0 },
    category: { type: String, default: "" },
    description: { type: String, default: "" },
    expense_date: { type: Date, default: null },
    receipt_url: { type: String, default: null },
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
    },
    current_step: { type: Number, default: 0 },
    rule_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApprovalRule",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Expense", expenseSchema);
