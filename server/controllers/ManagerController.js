const { Expense, ExpenseApproval, User, ApprovalRule, Company } = require("../models");
const { advanceAfterApproval, rejectAllPending, clearPendingApprovals } = require("../services/approvalEngine");
const { sendExpensePendingForApprover, sendExpenseDecisionToEmployee } = require("../utils/mailer");

const ok = (res, status, message, data) => res.status(status).json({ success: true, message, data });
const err = (res, status, message) => res.status(status).json({ success: false, message });

function formatApprovalRow(approval, approverUser, company) {
  const exp = approval._expense;
  const sub = exp?._submitter;
  const cur = company?.currency_code || "USD";
  return {
    id: approval._id.toString(),
    approvalId: approval._id.toString(),
    expenseId: exp._id.toString(),
    reviewerLabel: approverUser?.name || "Approver",
    reviewerSubtext: "Pending your action",
    requestOwner: sub?.name || "—",
    requestOwnerEmail: sub?.email || "",
    category: exp.category || "—",
    status: exp.status,
    amountOriginal: `${exp.amount} ${exp.currency_code}`,
    conversionNote: `(converted to ${cur})`,
    amountInCompanyCurrency: Number(exp.amount_in_company_currency || 0),
    receiptUrl: exp.receipt_url || null,
  };
}

async function notifyAfterApproveCommit({ expenseId, actingApproverId, comment, newPendingApproverIds }) {
  const exp = await Expense.findById(expenseId);
  if (!exp) return;
  const submitter = await User.findById(exp.submitted_by);
  const acting = await User.findById(actingApproverId);
  if (!submitter?.email) return;
  if (exp.status === "approved") {
    try { await sendExpenseDecisionToEmployee({ to: submitter.email, employeeName: submitter.name, expenseId: exp._id.toString(), decision: "approved", reason: comment, category: exp.category, amount: String(exp.amount), currency: exp.currency_code, approverName: acting?.name }); } catch (e) { console.error("notifyAfterApproveCommit (employee):", e.message); }
    return;
  }
  for (const aid of (newPendingApproverIds || [])) {
    try { const a = await User.findById(aid); if (!a?.email) continue; await sendExpensePendingForApprover({ to: a.email, approverName: a.name, submitterName: submitter.name, expenseId: exp._id.toString(), category: exp.category, amount: String(exp.amount), currency: exp.currency_code }); } catch (e) { console.error("notifyAfterApproveCommit (next approver):", e.message); }
  }
}

async function notifyAfterRejectCommit({ expenseId, actingApproverId, comment }) {
  const exp = await Expense.findById(expenseId);
  if (!exp) return;
  const submitter = await User.findById(exp.submitted_by);
  const acting = await User.findById(actingApproverId);
  if (!submitter?.email) return;
  try { await sendExpenseDecisionToEmployee({ to: submitter.email, employeeName: submitter.name, expenseId: exp._id.toString(), decision: "rejected", reason: comment, category: exp.category, amount: String(exp.amount), currency: exp.currency_code, approverName: acting?.name }); } catch (e) { console.error("notifyAfterRejectCommit:", e.message); }
}

const listPendingApprovals = async (req, res) => {
  try {
    const approverId = req.user._id;
    const me = await User.findById(approverId);
    const company = await Company.findById(req.user.company_id);
    const approvals = await ExpenseApproval.find({ approver_id: approverId, status: "pending" }).lean();
    const expenseIds = approvals.map((a) => a.expense_id);
    const expenses = await Expense.find({ _id: { $in: expenseIds }, status: "pending" }).lean();
    const expMap = new Map(expenses.map((e) => [e._id.toString(), e]));
    const submitterIds = [...new Set(expenses.map((e) => e.submitted_by.toString()))];
    const submitters = await User.find({ _id: { $in: submitterIds } }).select("_id name email").lean();
    const subMap = new Map(submitters.map((s) => [s._id.toString(), s]));

    const items = [];
    for (const a of approvals) {
      const exp = expMap.get(a.expense_id.toString());
      if (!exp) continue;
      exp._submitter = subMap.get(exp.submitted_by.toString()) || null;
      a._expense = exp;
      items.push(formatApprovalRow(a, me, company));
    }
    return ok(res, 200, "OK", { items });
  } catch (e) { console.error("listPendingApprovals:", e); return err(res, 500, "Could not load approvals."); }
};

const approveExpense = async (req, res) => {
  let newPendingApproverIds = [];
  let shouldNotify = false;
  try {
    const expenseId = req.params.expenseId;
    const approverId = req.user._id;
    const { comment } = req.body || {};
    const session = await Expense.startSession();
    try {
      await session.withTransaction(async () => {
      const approval = await ExpenseApproval.findOneAndUpdate(
        { expense_id: expenseId, approver_id: approverId, status: "pending" },
        { $set: { status: "approved", acted_at: new Date(), comment: comment || null } },
        { new: true, session },
      );
      if (!approval) throw new Error("NO_PENDING_APPROVAL");

      const expense = await Expense.findById(expenseId).session(session);
      if (!expense) throw new Error("EXPENSE_NOT_FOUND");
      if (expense.company_id.toString() !== req.user.company_id) {
        throw new Error("ACCESS_DENIED");
      }

      const rule = expense.rule_id
        ? await ApprovalRule.findById(expense.rule_id).session(session)
        : null;

      if (!rule) {
        expense.status = "approved";
        await expense.save({ session });
        await clearPendingApprovals(expense._id, { session });
      } else {
        const adv = await advanceAfterApproval(expense, rule, approval, { session });
        newPendingApproverIds = adv?.newPendingApproverIds || [];
        if (expense.status === "approved") {
          await clearPendingApprovals(expense._id, { session });
        }
      }
      shouldNotify = true;
      });
    } finally {
      await session.endSession();
    }
    if (shouldNotify) {
      await notifyAfterApproveCommit({
        expenseId,
        actingApproverId: approverId,
        comment,
        newPendingApproverIds,
      });
    }
    return ok(res, 200, "Expense approved.", { expenseId });
  } catch (e) {
    if (e.message === "NO_PENDING_APPROVAL") {
      return err(res, 404, "No pending approval found for you on this expense.");
    }
    if (e.message === "EXPENSE_NOT_FOUND") return err(res, 404, "Expense not found.");
    if (e.message === "ACCESS_DENIED") return err(res, 403, "Access denied.");
    console.error("approveExpense:", e);
    return err(res, 500, "Could not approve expense.");
  }
};

const rejectExpense = async (req, res) => {
  let shouldNotify = false;
  try {
    const expenseId = req.params.expenseId;
    const approverId = req.user._id;
    const { comment } = req.body || {};
    const reason = comment != null ? String(comment).trim() : "";
    if (!reason) return err(res, 400, "Rejection reason is required (sent to the employee).");
    const session = await Expense.startSession();
    try {
      await session.withTransaction(async () => {
      const approval = await ExpenseApproval.findOneAndUpdate(
        { expense_id: expenseId, approver_id: approverId, status: "pending" },
        { $set: { status: "rejected", acted_at: new Date(), comment: reason } },
        { new: true, session },
      );
      if (!approval) throw new Error("NO_PENDING_APPROVAL");

      const expense = await Expense.findById(expenseId).session(session);
      if (!expense) throw new Error("EXPENSE_NOT_FOUND");
      if (expense.company_id.toString() !== req.user.company_id) {
        throw new Error("ACCESS_DENIED");
      }

      expense.status = "rejected";
      await expense.save({ session });
      await rejectAllPending(expense._id, { session });
      shouldNotify = true;
      });
    } finally {
      await session.endSession();
    }
    if (shouldNotify) {
      await notifyAfterRejectCommit({
        expenseId,
        actingApproverId: approverId,
        comment: reason,
      });
    }
    return ok(res, 200, "Expense rejected.", { expenseId });
  } catch (e) {
    if (e.message === "NO_PENDING_APPROVAL") {
      return err(res, 404, "No pending approval found for you on this expense.");
    }
    if (e.message === "EXPENSE_NOT_FOUND") return err(res, 404, "Expense not found.");
    if (e.message === "ACCESS_DENIED") return err(res, 403, "Access denied.");
    console.error("rejectExpense:", e);
    return err(res, 500, "Could not reject expense.");
  }
};

module.exports = { listPendingApprovals, approveExpense, rejectExpense };
