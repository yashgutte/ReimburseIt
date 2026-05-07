import axiosInstance from "../Authorisation/axiosConfig";

const STORAGE_KEY = "rms_employee_expenses_v1";

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRaw(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const DEFAULT_BASE_CURRENCY = "INR";

export const EXPENSE_CATEGORIES = [
  "Food",
  "Travel",
  "Lodging",
  "Supplies",
  "Software",
  "Other",
];

export const CURRENCIES = ["INR"];

export const PAID_BY_OPTIONS = ["Self", "Company card", "Other"];

function mapServerExpenseToRow(exp, employeeName) {
  const x = exp?.dataValues ?? exp;
  const idVal = String(x._id || x.id);
  const ed = x.expense_date ?? x.expenseDate;
  const dateStr = ed == null ? "" : String(ed).slice(0, 10);
  const createdRaw = x.created_at ?? x.createdAt;
  const created = createdRaw
    ? new Date(createdRaw).toISOString()
    : new Date().toISOString();
  const receipt = x.receipt_url ?? x.receiptUrl;
  return {
    id: `srv_${idVal}`,
    serverId: idVal,
    employeeName: employeeName || "",
    description: x.description || "",
    expenseDate: dateStr,
    category: x.category || "Other",
    paidBy: "Self",
    remarks: "",
    amount: Number(x.amount),
    currencyCode: x.currency_code || x.currencyCode || DEFAULT_BASE_CURRENCY,
    amountInCompanyCurrency:
      x.amount_in_company_currency != null || x.amountInCompanyCurrency != null
        ? Number(x.amount_in_company_currency ?? x.amountInCompanyCurrency)
        : null,
    detailedDescription: "",
    receiptFileName: receipt ? String(receipt).split("/").pop() : null,
    status: x.status,
    approvalLog: [],
    createdAt: created,
    updatedAt: created,
  };
}

function removeDraftById(id) {
  const list = loadRaw().filter((e) => e.id !== id);
  saveRaw(list);
}

function buildDescription({ description, remarks, detailedDescription }) {
  return [description, remarks, detailedDescription]
    .map((part) => (part != null ? String(part).trim() : ""))
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Submit one expense to the API (creates server-side approval workflow).
 * @param {object} payload
 * @param {string} [payload.description]
 * @param {string} [payload.expenseDate] YYYY-MM-DD
 * @param {string} [payload.category]
 * @param {number} payload.amount
 * @param {string} [payload.currencyCode]
 * @param {string} [payload.remarks]
 * @param {string} [payload.detailedDescription]
 * @param {File|null} [payload.receiptFile]
 */
export async function submitExpensePayloadToServer(payload) {
  const {
    description,
    expenseDate,
    category,
    amount,
    currencyCode,
    remarks,
    detailedDescription,
    receiptFile,
  } = payload;
  const desc = buildDescription({
    description,
    remarks,
    detailedDescription,
  });
  const fd = new FormData();
  fd.append("amount", String(amount));
  fd.append("currency_code", (currencyCode || DEFAULT_BASE_CURRENCY).toUpperCase());
  fd.append("category", category || "Other");
  fd.append("description", desc || "");
  fd.append("expense_date", expenseDate);
  if (receiptFile) fd.append("receipt", receiptFile);
  const { data } = await axiosInstance.post("/api/expenses", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  if (!data?.success) {
    throw new Error(data?.message || "Could not submit expense.");
  }
  return data;
}

export async function fetchMyExpenses(employeeName = "") {
  const localDrafts = loadRaw().filter(
    (e) =>
      e.status === "draft" &&
      (employeeName
        ? String(e.employeeName || "").trim() === String(employeeName).trim()
        : true),
  );
  let serverRows = [];
  try {
    const { data } = await axiosInstance.get("/api/expenses/mine");
    const expenses = data?.data?.expenses ?? [];
    serverRows = Array.isArray(expenses)
      ? expenses.map((e) => mapServerExpenseToRow(e, employeeName))
      : [];
  } catch (e) {
    console.warn("fetchMyExpenses API:", e?.message || e);
  }
  const merged = [...localDrafts, ...serverRows];
  return merged.sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt),
  );
}

export async function createDraftExpense(partial = {}) {
  const now = new Date().toISOString();
  const row = {
    id: uid(),
    employeeName: partial.employeeName || "",
    description: partial.description || "",
    expenseDate: partial.expenseDate || now.slice(0, 10),
    category: partial.category || "Other",
    paidBy: partial.paidBy || "Self",
    remarks: partial.remarks || "",
    amount: partial.amount ?? 0,
    currencyCode: partial.currencyCode || DEFAULT_BASE_CURRENCY,
    amountInCompanyCurrency: partial.amountInCompanyCurrency ?? null,
    detailedDescription: partial.detailedDescription || "",
    receiptFileName: partial.receiptFileName || null,
    status: "draft",
    approvalLog: [],
    createdAt: now,
    updatedAt: now,
  };
  const list = loadRaw();
  list.push(row);
  saveRaw(list);
  return row;
}

export async function updateExpense(id, patch) {
  const list = loadRaw();
  const i = list.findIndex((e) => e.id === id);
  if (i === -1) throw new Error("Expense not found");
  const cur = list[i];
  if (cur.status !== "draft") {
    throw new Error("Only draft expenses can be edited");
  }
  const next = {
    ...cur,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  list[i] = next;
  saveRaw(list);
  return next;
}

/**
 * @param {string} id Local draft id
 * @param {{ receiptFile?: File|null }} [options]
 */
export async function submitExpense(id, options = {}) {
  const { receiptFile } = options;
  const list = loadRaw();
  const i = list.findIndex((e) => e.id === id);
  if (i === -1) throw new Error("Expense not found");
  const cur = list[i];
  if (cur.status !== "draft") throw new Error("Already submitted");

  const amount = Number(cur.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid amount");
  }

  await submitExpensePayloadToServer({
    description: cur.description,
    expenseDate: (cur.expenseDate || "").slice(0, 10),
    category: cur.category,
    amount,
    currencyCode: cur.currencyCode,
    remarks: cur.remarks,
    detailedDescription: cur.detailedDescription,
    receiptFile: receiptFile || null,
  });
  removeDraftById(id);
  return { ok: true };
}

/**
 * Upload receipt to server; Gemini OCR extracts fields and converts amount to company currency.
 * @param {File} file
 * @param {{ companyCurrency?: string }} [opts] - Used when not logged in (no JWT). Logged-in users use company from token.
 */
export async function parseReceiptStub(file, opts = {}) {
  if (!file) throw new Error("No file selected");
  const fd = new FormData();
  fd.append("receipt", file);
  const cc = (opts.companyCurrency || DEFAULT_BASE_CURRENCY).toUpperCase().slice(0, 3);
  fd.append("companyCurrency", cc);
  const { data } = await axiosInstance.post("/api/expenses/parse-receipt", fd);
  if (!data?.success) {
    throw new Error(data?.message || "Could not parse receipt");
  }
  const d = data.data || {};
  return {
    description: d.description || "",
    amount:
      d.amount != null && Number.isFinite(Number(d.amount))
        ? Number(d.amount)
        : null,
    currencyCode: d.currencyCode || DEFAULT_BASE_CURRENCY,
    expenseDate: d.expenseDate || null,
    category: d.category || "Other",
    remarks: d.remarks || "",
    detailedDescription: d.detailedDescription || "",
    amountInCompanyCurrency:
      d.amountInCompanyCurrency != null
        ? Number(d.amountInCompanyCurrency)
        : null,
  };
}

export function summarizeByStatus(expenses) {
  const sums = { draft: 0, pending: 0, approved: 0 };
  for (const e of expenses) {
    const n = Number(e.amount) || 0;
    if (e.status === "draft") sums.draft += n;
    else if (e.status === "pending") sums.pending += n;
    else if (e.status === "approved") sums.approved += n;
  }
  return sums;
}

export function statusLabel(status) {
  switch (status) {
    case "draft":
      return "Draft";
    case "pending":
      return "Submitted";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}
