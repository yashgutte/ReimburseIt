import axiosInstance from "../../Authorisation/axiosConfig";

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const RULE_TYPE_OPTIONS = [
  {
    value: "sequential",
    label: "Sequential",
    hint: "Claim moves stage by stage; each approver must pass before the next.",
    accent: "border-teal-500/40 bg-teal-500/[0.07] text-teal-200/90",
    ring: "data-[active=true]:border-teal-400/60 data-[active=true]:ring-2 data-[active=true]:ring-teal-500/30",
  },
  {
    value: "percentage",
    label: "Percentage",
    hint: "A threshold % of the group must approve (e.g. 2 of 3).",
    accent: "border-violet-500/40 bg-violet-500/[0.07] text-violet-200/90",
    ring: "data-[active=true]:border-violet-400/60 data-[active=true]:ring-2 data-[active=true]:ring-violet-500/30",
  },
  {
    value: "specific",
    label: "Specific approver",
    hint: "One designated person must approve.",
    accent: "border-amber-500/40 bg-amber-500/[0.07] text-amber-200/90",
    ring: "data-[active=true]:border-amber-400/60 data-[active=true]:ring-2 data-[active=true]:ring-amber-500/30",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    hint: "Either the minimum % is met OR the special approver approves.",
    accent: "border-rose-500/40 bg-rose-500/[0.07] text-rose-200/90",
    ring: "data-[active=true]:border-rose-400/60 data-[active=true]:ring-2 data-[active=true]:ring-rose-500/30",
  },
  {
    value: "all",
    label: "All (any one)",
    hint: "Everyone in the group is notified; the first approval completes the claim.",
    accent: "border-sky-500/40 bg-sky-500/[0.07] text-sky-200/90",
    ring: "data-[active=true]:border-sky-400/60 data-[active=true]:ring-2 data-[active=true]:ring-sky-500/30",
  },
];

export function emptyRuleForm() {
  return {
    name: "",
    description: "",
    category: "All",
    subjectUserId: "",
    managerId: "",
    ruleType: "sequential",
    isManagerApprover: false,
    approversSequence: true,
    minApprovalPct: 50,
    specificApproverId: "",
    approvers: [{ rowId: uid(), userId: "", required: true }],
  };
}

function mapRuleFromApi(r) {
  // MongoDB uses _id, but the server may return id or _id
  const ruleId = String(r._id || r.id);
  const seq = r.approver_sequence || [];
  return {
    id: ruleId,
    name: r.name,
    description: r.description || "",
    category: r.category || "All",
    subjectUserId: r.subject_user_id ? String(r.subject_user_id) : "",
    managerId: r.rule_manager_id ? String(r.rule_manager_id) : "",
    ruleType: r.rule_type,
    isManagerApprover: Boolean(r.is_manager_approver),
    approversSequence: true,
    minApprovalPct: r.min_approval_pct ?? 50,
    specificApproverId: r.specific_approver_id
      ? String(r.specific_approver_id)
      : "",
    approvers:
      seq.length > 0
        ? seq.map((id, i) => ({
            rowId: `row-${ruleId}-${i}`,
            userId: String(id),
            required: true,
          }))
        : [{ rowId: uid(), userId: "", required: true }],
  };
}

function buildPayload(form) {
  // Keep user IDs as strings (MongoDB ObjectId strings), don't convert to Number
  const approverSequence = form.approvers
    .filter((a) => a.userId)
    .map((a) => String(a.userId));
  return {
    name: form.name,
    description: form.description,
    category: form.category || "All",
    ruleType: form.ruleType,
    isManagerApprover: form.isManagerApprover,
    subjectUserId: form.subjectUserId || null,
    managerId: form.managerId || null,
    approvers: form.approvers,
    approverSequence,
    minApprovalPct:
      form.ruleType === "percentage" || form.ruleType === "hybrid"
        ? Number(form.minApprovalPct)
        : null,
    specificApproverId:
      form.ruleType === "specific" || form.ruleType === "hybrid"
        ? form.specificApproverId || null
        : null,
  };
}

export async function listApprovalRules() {
  const { data } = await axiosInstance.get("/api/admin/approval-rules");
  const inner = data?.data ?? data;
  const rules = inner?.rules ?? [];
  return Array.isArray(rules) ? rules.map(mapRuleFromApi) : [];
}

export async function getApprovalRule(id) {
  const list = await listApprovalRules();
  return list.find((r) => r.id === String(id)) || null;
}

export async function upsertApprovalRule(payload) {
  const body = buildPayload(payload);
  if (payload.id) {
    const { data } = await axiosInstance.put(
      `/api/admin/approval-rules/${payload.id}`,
      body,
    );
    return data;
  }
  const { data } = await axiosInstance.post("/api/admin/approval-rules", body);
  return data;
}

export async function deleteApprovalRule(id) {
  await axiosInstance.delete(`/api/admin/approval-rules/${id}`);
}
