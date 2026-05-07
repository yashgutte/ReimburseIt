const { ApprovalRule, User } = require("../models");

const ok = (res, status, message, data) => res.status(status).json({ success: true, message, data });
const err = (res, status, message) => res.status(status).json({ success: false, message });

async function assertUsersInCompany(company_id, ids) {
  const unique = [...new Set((ids || []).filter(Boolean).map(String))];
  if (unique.length === 0) return true;
  const n = await User.countDocuments({ company_id, _id: { $in: unique } });
  return n === unique.length;
}

function pickBody(req) {
  const b = req.body || {};
  return {
    name: b.name, description: b.description,
    category: b.category ?? b.categoryName,
    rule_type: b.rule_type ?? b.ruleType,
    is_manager_approver: b.is_manager_approver ?? b.isManagerApprover,
    approver_sequence: b.approver_sequence ?? b.approverSequence ?? b.approvers,
    min_approval_pct: b.min_approval_pct ?? b.minApprovalPct,
    specific_approver_id: b.specific_approver_id ?? b.specificApproverId,
    subject_user_id: b.subject_user_id ?? b.subjectUserId,
    rule_manager_id: b.rule_manager_id ?? b.managerId ?? b.ruleManagerId,
  };
}

function normalizeSequence(seq) {
  if (Array.isArray(seq)) {
    return seq.map((x) => (typeof x === "object" && x != null ? x.userId ?? x.id : x)).filter(Boolean);
  }
  return [];
}

const createRule = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const b = pickBody(req);
    let { approver_sequence } = b;
    approver_sequence = normalizeSequence(approver_sequence);
    const { name, description, category, rule_type, is_manager_approver, min_approval_pct, specific_approver_id, subject_user_id, rule_manager_id } = b;
    if (!name || !rule_type) return err(res, 400, "Rule name and rule_type are required.");
    const validRuleTypes = ["sequential", "percentage", "specific", "hybrid", "all"];
    if (!validRuleTypes.includes(rule_type)) return err(res, 400, `rule_type must be one of: ${validRuleTypes.join(", ")}`);
    if (rule_type === "sequential" && approver_sequence.length === 0 && !is_manager_approver) return err(res, 400, "Sequential rules need approvers or manager as approver.");
    if (rule_type === "percentage") {
      if (!min_approval_pct || min_approval_pct <= 0 || min_approval_pct > 100) return err(res, 400, "Percentage rules require min_approval_pct between 1 and 100.");
      if (approver_sequence.length === 0 && !is_manager_approver) return err(res, 400, "Percentage rules need approvers or manager as approver.");
    }
    if (rule_type === "all" && approver_sequence.length === 0 && !is_manager_approver) return err(res, 400, "All (any-one) rules need approvers or manager as approver.");
    if (rule_type === "specific" && !specific_approver_id) return err(res, 400, "Specific rules require specific_approver_id.");
    if (rule_type === "hybrid") {
      if (!min_approval_pct || min_approval_pct <= 0 || min_approval_pct > 100) return err(res, 400, "Hybrid rules require min_approval_pct between 1 and 100.");
      if (!specific_approver_id) return err(res, 400, "Hybrid rules require specific_approver_id.");
    }
    const idsToCheck = [...approver_sequence, specific_approver_id, subject_user_id, rule_manager_id].filter(Boolean);
    if (!(await assertUsersInCompany(company_id, idsToCheck))) return err(res, 400, "One or more users are not in your company.");
    const newRule = await ApprovalRule.create({ company_id, name: String(name).trim(), description: description ? String(description).trim() : null, category: (category && String(category).trim()) || "All", rule_type, is_manager_approver: Boolean(is_manager_approver), approver_sequence, min_approval_pct: min_approval_pct || null, specific_approver_id: specific_approver_id || null, subject_user_id: subject_user_id || null, rule_manager_id: rule_manager_id || null });
    return ok(res, 201, "Approval rule created successfully.", { rule: newRule });
  } catch (error) { console.error("Create Rule Error:", error); return err(res, 500, "Internal server error while creating rule."); }
};

const updateRule = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const id = req.params.id;
    const rule = await ApprovalRule.findOne({ _id: id, company_id });
    if (!rule) return err(res, 404, "Rule not found.");
    const b = pickBody(req);
    let approver_sequence = normalizeSequence(b.approver_sequence ?? rule.approver_sequence);
    const fields = {
      name: b.name != null ? String(b.name).trim() : rule.name,
      description: b.description !== undefined ? (b.description ? String(b.description).trim() : null) : rule.description,
      category: b.category != null ? String(b.category).trim() || "All" : rule.category,
      rule_type: b.rule_type ?? rule.rule_type,
      is_manager_approver: b.is_manager_approver != null ? Boolean(b.is_manager_approver) : rule.is_manager_approver,
      approver_sequence,
      min_approval_pct: b.min_approval_pct !== undefined ? b.min_approval_pct : rule.min_approval_pct,
      specific_approver_id: b.specific_approver_id !== undefined ? b.specific_approver_id : rule.specific_approver_id,
      subject_user_id: b.subject_user_id !== undefined ? b.subject_user_id : rule.subject_user_id,
      rule_manager_id: b.rule_manager_id !== undefined ? b.rule_manager_id : rule.rule_manager_id,
    };
    const idsToCheck = [...normalizeSequence(fields.approver_sequence), fields.specific_approver_id, fields.subject_user_id, fields.rule_manager_id].filter(Boolean);
    if (!(await assertUsersInCompany(company_id, idsToCheck))) return err(res, 400, "One or more users are not in your company.");
    Object.assign(rule, fields);
    await rule.save();
    return ok(res, 200, "Rule updated.", { rule });
  } catch (e) { console.error("updateRule:", e); return err(res, 500, "Could not update rule."); }
};

const deleteRule = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const id = req.params.id;
    const rule = await ApprovalRule.findOne({ _id: id, company_id });
    if (!rule) return err(res, 404, "Rule not found.");
    await rule.deleteOne();
    return ok(res, 200, "Rule deleted.", {});
  } catch (e) { console.error("deleteRule:", e); return err(res, 500, "Could not delete rule."); }
};

const getCompanyRules = async (req, res) => {
  try {
    const rules = await ApprovalRule.find({ company_id: req.user.company_id }).sort({ _id: -1 });
    return ok(res, 200, "OK", { rules });
  } catch (error) { console.error("Get Rules Error:", error); return err(res, 500, "Internal server error."); }
};

module.exports = { createRule, updateRule, deleteRule, getCompanyRules };
