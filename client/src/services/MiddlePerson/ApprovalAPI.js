import axiosInstance from "../../Authorisation/axiosConfig";

/**
 * @typedef {Object} ApprovalRow
 * @property {string} id
 * @property {number} [expenseId]
 * @property {string} reviewerLabel
 * @property {string} reviewerSubtext
 * @property {string} requestOwner
 * @property {string} category
 * @property {string} status
 * @property {string} amountOriginal
 * @property {string} conversionNote
 * @property {number} amountInCompanyCurrency
 * @property {string|null} [receiptUrl]
 */

function normalizeApproval(raw) {
  const expenseId = String(
    raw.expenseId ??
      raw.expense_id ??
      raw.expenseID ??
      (raw.expense && (raw.expense._id ?? raw.expense.id ?? raw.expense_id)) ??
      "",
  );
  return {
    id: String(raw.approvalId ?? raw._id ?? raw.id ?? expenseId),
    expenseId,
    reviewerLabel:
      raw.reviewerLabel ?? raw.managerName ?? raw.badgeLabel ?? "Approver",
    reviewerSubtext: raw.reviewerSubtext ?? raw.badgeSubtext ?? "Pending",
    requestOwner:
      raw.requestOwner ?? raw.ownerName ?? raw.employeeName ?? "—",
    category: raw.category ?? raw.categoryName ?? "—",
    status: raw.status ?? raw.requestStatus ?? "pending",
    amountOriginal: raw.amountOriginal ?? raw.originalAmountLabel ?? "",
    conversionNote: raw.conversionNote ?? "",
    amountInCompanyCurrency: Number(
      raw.amountInCompanyCurrency ?? raw.convertedAmount ?? 0,
    ),
    receiptUrl: raw.receiptUrl ?? raw.receipt_url ?? null,
  };
}

export function absoluteReceiptUrl(relativeOrAbsolute) {
  if (!relativeOrAbsolute) return null;
  const s = String(relativeOrAbsolute);
  if (/^https?:\/\//i.test(s)) return s;
  const base = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
  return `${base}${s.startsWith("/") ? s : `/${s}`}`;
}

function extractItems(body) {
  const payload = body?.data !== undefined ? body.data : body;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.approvals)) return payload.approvals;
  return [];
}

/**
 * @returns {Promise<ApprovalRow[]>}
 */
export async function fetchPendingApprovals() {
  const res = await axiosInstance.get("/api/manager/approvals");
  return extractItems(res.data).map(normalizeApproval);
}

export async function approveExpense(expenseId, comment) {
  const { data } = await axiosInstance.post(
    `/api/manager/approvals/${expenseId}/approve`,
    { comment: comment || undefined },
  );
  return data;
}

export async function rejectExpense(expenseId, comment) {
  const { data } = await axiosInstance.post(
    `/api/manager/approvals/${expenseId}/reject`,
    { comment: comment || undefined },
  );
  return data;
}
