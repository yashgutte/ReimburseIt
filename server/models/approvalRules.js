const { mongoose } = require("./db");

const approvalRuleSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },
    name: { type: String, default: "" },
    description: { type: String, default: null },
    category: { type: String, default: "All" },
    rule_type: {
      type: String,
      enum: ["sequential", "percentage", "specific", "hybrid", "all"],
      required: true,
    },
    is_manager_approver: { type: Boolean, default: false },
    subject_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rule_manager_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approver_sequence: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    min_approval_pct: { type: Number, default: null },
    specific_approver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ApprovalRule", approvalRuleSchema);
