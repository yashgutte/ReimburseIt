const { ApprovalRule, User, ExpenseApproval } = require("../models");

function normalizeSeq(seq) {
  if (!Array.isArray(seq)) return [];
  return seq.filter(Boolean).map(String);
}

function uniqueChain(ids) {
  const seen = new Set(); const out = [];
  for (const x of ids) { if (!x || seen.has(x)) continue; seen.add(x); out.push(x); }
  return out;
}

function buildSequentialChain(rule, employee) {
  const seq = normalizeSeq(rule.approver_sequence);
  const mgr = rule.is_manager_approver ? (rule.rule_manager_id?.toString() || employee.manager_id?.toString()) : null;
  const chain = []; if (mgr) chain.push(mgr); chain.push(...seq);
  return uniqueChain(chain);
}

function parallelPool(rule, employee) {
  const seq = normalizeSeq(rule.approver_sequence);
  const mgr = rule.is_manager_approver ? (rule.rule_manager_id?.toString() || employee.manager_id?.toString()) : null;
  const p = []; if (mgr) p.push(mgr); p.push(...seq);
  return uniqueChain(p);
}

function normCategoryToken(s) { return String(s || "").trim().toLowerCase(); }

async function findApplicableRule(companyId, employeeId, category) {
  const rules = await ApprovalRule.find({ company_id: companyId }).sort({ _id: 1 });
  const expCat = normCategoryToken(category);
  const scored = [];
  for (const rule of rules) {
    if (rule.subject_user_id && rule.subject_user_id.toString() !== employeeId.toString()) continue;
    const rcRaw = String(rule.category || "All").trim();
    const ruleIsAll = !rcRaw || normCategoryToken(rcRaw) === normCategoryToken("All");
    if (!ruleIsAll && normCategoryToken(rcRaw) !== expCat) continue;
    let score = 0;
    if (rule.subject_user_id && rule.subject_user_id.toString() === employeeId.toString()) score += 100;
    if (!ruleIsAll && normCategoryToken(rcRaw) === expCat) score += 50;
    else if (ruleIsAll) score += 10;
    scored.push({ rule, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.rule || null;
}

async function createInitialApprovals(expense, rule, employee) {
  const { rule_type } = rule;
  const chain = buildSequentialChain(rule, employee);
  switch (rule_type) {
    case "sequential": {
      if (chain.length === 0) { expense.status = "approved"; expense.rule_id = rule._id; await expense.save(); return; }
      await ExpenseApproval.create({ expense_id: expense._id, approver_id: chain[0], step: 1, status: "pending" });
      expense.current_step = 1; expense.status = "pending"; expense.rule_id = rule._id; await expense.save(); return;
    }
    case "specific": {
      const aid = rule.specific_approver_id;
      if (!aid) { expense.status = "approved"; expense.rule_id = rule._id; await expense.save(); return; }
      await ExpenseApproval.create({ expense_id: expense._id, approver_id: aid, step: 1, status: "pending" });
      expense.current_step = 1; expense.status = "pending"; expense.rule_id = rule._id; await expense.save(); return;
    }
    case "percentage": {
      const ids = parallelPool(rule, employee);
      if (ids.length === 0) { expense.status = "approved"; expense.rule_id = rule._id; await expense.save(); return; }
      for (const aid of ids) { await ExpenseApproval.create({ expense_id: expense._id, approver_id: aid, step: 1, status: "pending", comment: "percentage:pool" }); }
      expense.current_step = 1; expense.status = "pending"; expense.rule_id = rule._id; await expense.save(); return;
    }
    case "all": {
      const ids = parallelPool(rule, employee);
      if (ids.length === 0) { expense.status = "approved"; expense.rule_id = rule._id; await expense.save(); return; }
      for (const aid of ids) { await ExpenseApproval.create({ expense_id: expense._id, approver_id: aid, step: 1, status: "pending", comment: "all:pool" }); }
      expense.current_step = 1; expense.status = "pending"; expense.rule_id = rule._id; await expense.save(); return;
    }
    case "hybrid": {
      const ids = parallelPool(rule, employee);
      const spec = rule.specific_approver_id;
      if (!spec && ids.length === 0) { expense.status = "approved"; expense.rule_id = rule._id; await expense.save(); return; }
      if (spec) { await ExpenseApproval.create({ expense_id: expense._id, approver_id: spec, step: 1, status: "pending", comment: "hybrid:specific" }); }
      for (const aid of ids) { if (spec && aid === spec.toString()) continue; await ExpenseApproval.create({ expense_id: expense._id, approver_id: aid, step: 1, status: "pending", comment: "hybrid:pool" }); }
      expense.current_step = 1; expense.status = "pending"; expense.rule_id = rule._id; await expense.save(); return;
    }
    default:
      expense.status = "approved"; expense.rule_id = rule._id; await expense.save();
  }
}

async function advanceAfterApproval(expense, rule, actingApproval, options = {}) {
  const { session } = options;
  const { rule_type } = rule;
  const out = { newPendingApproverIds: [] };
  if (rule_type === "sequential") {
    const employee = await User.findById(expense.submitted_by).session(session || null);
    const chain = buildSequentialChain(rule, employee);
    const completed = await ExpenseApproval.countDocuments({
      expense_id: expense._id,
      status: "approved",
    }).session(session || null);
    if (completed >= chain.length) {
      expense.status = "approved";
      await expense.save({ session });
      return out;
    }
    const nextApprover = chain[completed];
    await ExpenseApproval.findOneAndUpdate(
      {
        expense_id: expense._id,
        approver_id: nextApprover,
        step: completed + 1,
        status: "pending",
      },
      {
        $setOnInsert: {
          expense_id: expense._id,
          approver_id: nextApprover,
          step: completed + 1,
          status: "pending",
        },
      },
      { upsert: true, new: true, session },
    );
    out.newPendingApproverIds.push(nextApprover);
    expense.current_step = completed + 1;
    await expense.save({ session });
    return out;
  }
  if (rule_type === "percentage") {
    const minPct = rule.min_approval_pct || 50;
    const stepRows = await ExpenseApproval.find({
      expense_id: expense._id,
      step: 1,
    }).session(session || null);
    const total = stepRows.length;
    const approved = stepRows.filter((r) => r.status === "approved").length;
    if (total > 0 && (approved / total) * 100 >= minPct) {
      expense.status = "approved";
      await expense.save({ session });
    }
    return out;
  }
  if (rule_type === "all") {
    const stepRows = await ExpenseApproval.find({
      expense_id: expense._id,
      step: 1,
    }).session(session || null);
    const total = stepRows.length;
    const approved = stepRows.filter((r) => r.status === "approved").length;
    if (total > 0 && approved >= total) {
      expense.status = "approved";
      await expense.save({ session });
    }
    return out;
  }
  if (rule_type === "specific") {
    expense.status = "approved";
    await expense.save({ session });
    return out;
  }
  if (rule_type === "hybrid") {
    const minPct = rule.min_approval_pct || 50;
    const specificId = rule.specific_approver_id?.toString();
    if (specificId && actingApproval.approver_id.toString() === specificId) {
      expense.status = "approved";
      await expense.save({ session });
      return out;
    }
    const poolRows = await ExpenseApproval.find({
      expense_id: expense._id,
      step: 1,
      comment: "hybrid:pool",
    }).session(session || null);
    if (poolRows.length === 0) return out;
    const total = poolRows.length;
    const approved = poolRows.filter((r) => r.status === "approved").length;
    if (total > 0 && (approved / total) * 100 >= minPct) {
      expense.status = "approved";
      await expense.save({ session });
    }
    return out;
  }
  return out;
}

async function fallbackManagerOnly(expense, employee) {
  if (employee.manager_id) {
    await ExpenseApproval.create({ expense_id: expense._id, approver_id: employee.manager_id, step: 1, status: "pending" });
    expense.current_step = 1; expense.status = "pending"; expense.rule_id = null; await expense.save();
  } else {
    expense.status = "approved"; await expense.save();
  }
}

async function rejectAllPending(expenseId, options = {}) {
  const { session } = options;
  await ExpenseApproval.updateMany(
    { expense_id: expenseId, status: "pending" },
    { status: "rejected", acted_at: new Date() },
    { session },
  );
}

async function clearPendingApprovals(expenseId, options = {}) {
  const { session } = options;
  await ExpenseApproval.deleteMany(
    { expense_id: expenseId, status: "pending" },
    { session },
  );
}

module.exports = { findApplicableRule, createInitialApprovals, advanceAfterApproval, fallbackManagerOnly, buildSequentialChain, parallelPool, rejectAllPending, clearPendingApprovals };
