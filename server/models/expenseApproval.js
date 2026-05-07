const { mongoose } = require("./db");

const expenseApprovalSchema = new mongoose.Schema(
  {
    expense_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      required: true,
    },
    approver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    step: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    comment: { type: String, default: null },
    acted_at: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ExpenseApproval", expenseApprovalSchema);
