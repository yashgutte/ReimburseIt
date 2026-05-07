import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  Upload,
  Paperclip,
  ChevronRight,
  Wallet,
  Eye,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import DashboardSidebar from "../../components/layout/DashboardSidebar";
import { employeeSidebarItems } from "../../lib/dashboard-nav";
import { AuthContext } from "../../context/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createDraftExpense,
  fetchMyExpenses,
  updateExpense,
  submitExpense,
  submitExpensePayloadToServer,
  parseReceiptStub,
  summarizeByStatus,
  statusLabel,
  DEFAULT_BASE_CURRENCY,
  EXPENSE_CATEGORIES,
  CURRENCIES,
  PAID_BY_OPTIONS,
} from "../../services/expenseService";

const cellInput =
  "h-7 min-w-0 rounded-md border border-white/10 bg-black/50 px-2 text-[11px] text-white placeholder:text-gray-600 focus-visible:border-cyan-500/50 focus-visible:ring-1 focus-visible:ring-cyan-400/35";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatLogTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })} · ${d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  } catch {
    return iso;
  }
}

// eslint-disable-next-line react/prop-types -- local presentational helper
function WorkflowStepper({ status }) {
  const steps = [
    { key: "draft", label: "Draft" },
    { key: "wait", label: "Waiting approval" },
    {
      key: "done",
      label: status === "rejected" ? "Rejected" : "Approved",
    },
  ];
  let active = 0;
  if (status === "pending") active = 1;
  if (status === "approved" || status === "rejected") active = 2;

  return (
    <div
      className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500"
      aria-label="Expense workflow"
    >
      {steps.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 font-medium",
              i === active &&
                (status === "rejected" && i === 2
                  ? "bg-rose-500/15 text-rose-300"
                  : "bg-cyan-500/15 text-cyan-300"),
              i < active && "text-gray-400",
              i > active && "text-gray-600"
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <ChevronRight className="size-3.5 shrink-0 text-gray-600" />
          )}
        </span>
      ))}
    </div>
  );
}

// eslint-disable-next-line react/prop-types -- local presentational helper
function StatusBadge({ status }) {
  const variant =
    status === "draft"
      ? "destructive"
      : status === "pending"
        ? "outline"
        : status === "approved"
          ? "default"
          : "secondary";
  const className =
    status === "pending"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : status === "approved"
        ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
        : "";
  return (
    <Badge variant={variant} className={cn("font-medium", className)}>
      {statusLabel(status)}
    </Badge>
  );
}

function defaultComposer() {
  const now = new Date().toISOString().slice(0, 10);
  return {
    description: "",
    expenseDate: now,
    category: "Other",
    paidBy: "Self",
    remarks: "",
    amount: "",
    currencyCode: DEFAULT_BASE_CURRENCY,
  };
}

function defaultUploadForm() {
  const now = new Date().toISOString().slice(0, 10);
  return {
    receiptFileName: null,
    description: "",
    expenseDate: now,
    category: "Other",
    paidBy: "Self",
    remarks: "",
    amount: "",
    currencyCode: DEFAULT_BASE_CURRENCY,
    detailedDescription: "",
  };
}

export default function SubmitExpense() {
  const { user } = useContext(AuthContext);
  const employeeName = user?.name || "You";
  const scope = {
    userId: user?.id || user?._id || "",
    companyId: user?.company_id || "",
  };
  const baseCurrency = user?.company_currency || DEFAULT_BASE_CURRENCY;
  const ocrCurrencyOpts = { companyCurrency: baseCurrency };

  const [rows, setRows] = useState([]);
  const [isPartialData, setIsPartialData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState(() => defaultComposer());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState(defaultUploadForm);
  const [uploadParsing, setUploadParsing] = useState(false);
  const [viewId, setViewId] = useState(null);
  const receiptInputRef = useRef(null);
  const uploadReceiptFileRef = useRef(null);
  const draftFilesRef = useRef(new Map());
  const attachDraftRef = useRef(null);
  const attachDraftIdRef = useRef(null);

  const viewRow = useMemo(
    () => (viewId ? rows.find((r) => r.id === viewId) : null),
    [rows, viewId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchMyExpenses({ employeeName, ...scope });
      setRows(result.rows);
      setIsPartialData(Boolean(result.partialData));
      if (result.partialData) {
        toast.warn("Server data unavailable. Showing local drafts only.");
      }
    } finally {
      setLoading(false);
    }
  }, [employeeName, scope.userId, scope.companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const sums = useMemo(() => summarizeByStatus(rows), [rows]);

  const persistPatch = async (id, patch) => {
    try {
      const updated = await updateExpense(id, patch, scope);
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      return updated;
    } catch (e) {
      toast.error(e.message || "Could not save");
      throw e;
    }
  };

  const handleAddFromComposer = async () => {
    const amount = Number(composer.amount);
    if (!composer.description?.trim()) {
      toast.error("Add a description");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      const row = await createDraftExpense({
        employeeName,
        description: composer.description.trim(),
        expenseDate: composer.expenseDate,
        category: composer.category,
        paidBy: composer.paidBy,
        remarks: composer.remarks || "",
        amount,
        currencyCode: composer.currencyCode,
      }, scope);
      setRows((prev) => [row, ...prev]);
      setComposer(defaultComposer());
      toast.success("Expense added");
    } catch (e) {
      toast.error(e.message || "Could not add");
    }
  };

  const openUploadDialog = () => {
    uploadReceiptFileRef.current = null;
    setUploadForm(defaultUploadForm());
    setUploadOpen(true);
  };

  const handleReceiptInDialog = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    uploadReceiptFileRef.current = file;
    setUploadParsing(true);
    try {
      const parsed = await parseReceiptStub(file, ocrCurrencyOpts);
      setUploadForm((f) => ({
        ...f,
        receiptFileName: file.name,
        description: parsed.description || f.description,
        ...(parsed.category ? { category: parsed.category } : {}),
        ...(parsed.remarks != null && String(parsed.remarks).trim() !== ""
          ? { remarks: parsed.remarks }
          : {}),
        ...(parsed.detailedDescription
          ? { detailedDescription: parsed.detailedDescription }
          : {}),
        ...(parsed.amount != null &&
        Number.isFinite(Number(parsed.amount)) &&
        Number(parsed.amount) > 0
          ? { amount: String(parsed.amount) }
          : {}),
        ...(parsed.currencyCode ? { currencyCode: parsed.currencyCode } : {}),
        ...(parsed.expenseDate ? { expenseDate: parsed.expenseDate } : {}),
      }));
      toast.success("Receipt scanned — review and edit below");
    } catch (err) {
      toast.error(err.message || "Could not read receipt");
    } finally {
      setUploadParsing(false);
    }
  };

  const saveUploadDraftToTable = async () => {
    const amount = Number(uploadForm.amount);
    if (!uploadForm.description?.trim()) {
      toast.error("Add a description");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      await createDraftExpense({
        employeeName,
        description: uploadForm.description.trim(),
        expenseDate: uploadForm.expenseDate,
        category: uploadForm.category,
        paidBy: uploadForm.paidBy,
        remarks: uploadForm.remarks || "",
        amount,
        currencyCode: uploadForm.currencyCode,
        detailedDescription: uploadForm.detailedDescription || "",
        receiptFileName: uploadForm.receiptFileName,
      }, scope);
      await load();
      setUploadOpen(false);
      toast.success("Saved to your list");
    } catch (e) {
      toast.error(e.message || "Could not save");
    }
  };

  const submitUploadDialog = async () => {
    const amount = Number(uploadForm.amount);
    if (!uploadForm.description?.trim()) {
      toast.error("Add a description");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      await submitExpensePayloadToServer({
        description: uploadForm.description.trim(),
        expenseDate: uploadForm.expenseDate,
        category: uploadForm.category,
        amount,
        currencyCode: uploadForm.currencyCode,
        remarks: uploadForm.remarks || "",
        detailedDescription: uploadForm.detailedDescription || "",
        receiptFile: uploadReceiptFileRef.current || null,
      });
      uploadReceiptFileRef.current = null;
      await load();
      setUploadOpen(false);
      toast.success("Submitted for approval");
    } catch (e) {
      toast.error(
        e?.response?.data?.message || e.message || "Submit failed",
      );
    }
  };

  const handleDraftAttach = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const id = attachDraftIdRef.current;
    if (!file || !id) return;
    draftFilesRef.current.set(id, file);
    try {
      const parsed = await parseReceiptStub(file, ocrCurrencyOpts);
      await persistPatch(id, {
        receiptFileName: file.name,
        ...(parsed.description ? { description: parsed.description } : {}),
        ...(parsed.expenseDate ? { expenseDate: parsed.expenseDate } : {}),
        ...(parsed.amount != null &&
        Number.isFinite(Number(parsed.amount)) &&
        Number(parsed.amount) > 0
          ? { amount: Number(parsed.amount) }
          : {}),
        ...(parsed.currencyCode ? { currencyCode: parsed.currencyCode } : {}),
        ...(parsed.category ? { category: parsed.category } : {}),
        ...(parsed.remarks != null && String(parsed.remarks).trim() !== ""
          ? { remarks: parsed.remarks }
          : {}),
        ...(parsed.detailedDescription
          ? { detailedDescription: parsed.detailedDescription }
          : {}),
      });
      toast.success("Receipt linked and fields updated");
    } catch (err) {
      toast.error(err.message || "Attach failed");
    }
    attachDraftIdRef.current = null;
  };

  const submitRow = async (id) => {
    try {
      const receiptFile = draftFilesRef.current.get(id) || null;
      await submitExpense(id, { receiptFile, scope });
      draftFilesRef.current.delete(id);
      await load();
      toast.success("Submitted for approval");
    } catch (e) {
      toast.error(
        e?.response?.data?.message || e.message || "Submit failed",
      );
    }
  };

  const renderViewDialogBody = () => {
    if (!viewRow) return null;
    const readonly = viewRow.status !== "draft";
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <WorkflowStepper status={viewRow.status} />
        </div>
        {viewRow.receiptFileName && (
          <p className="text-xs text-gray-500">
            Receipt:{" "}
            <span className="text-gray-300">{viewRow.receiptFileName}</span>
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-gray-300">Description</Label>
            <Input
              readOnly={readonly}
              value={viewRow.description}
              className={readonly ? "opacity-80" : ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-300">Expense date</Label>
            <Input
              readOnly
              value={viewRow.expenseDate?.slice(0, 10) || ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-300">Category</Label>
            <Input readOnly value={viewRow.category} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-300">Paid by</Label>
            <Input readOnly value={viewRow.paidBy} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-gray-300">Amount</Label>
            <p className="text-sm text-white">
              {Number(viewRow.amount) || 0} {viewRow.currencyCode}
            </p>
            {viewRow.status !== "draft" &&
              viewRow.amountInCompanyCurrency != null && (
                <p className="text-xs text-gray-500">
                  Company ({baseCurrency}):{" "}
                  <span className="font-medium text-cyan-300/90">
                    {viewRow.amountInCompanyCurrency} {baseCurrency}
                  </span>
                </p>
              )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-gray-300">Remarks</Label>
            <Input readOnly value={viewRow.remarks || ""} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-gray-300">Detailed description</Label>
            <Textarea
              readOnly
              value={viewRow.detailedDescription || ""}
              className="min-h-[80px] border-white/10 bg-black/40 text-white"
            />
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30">
          <div className="border-b border-white/10 px-3 py-2 text-xs font-medium text-gray-400">
            Approval history
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="px-3 py-2 font-medium">Approver</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {(viewRow.approvalLog || []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-4 text-center text-gray-600"
                    >
                      No entries yet
                    </td>
                  </tr>
                ) : (
                  viewRow.approvalLog.map((log, idx) => (
                    <tr
                      key={`${log.time}-${idx}`}
                      className="border-t border-white/5 text-gray-300"
                    >
                      <td className="px-3 py-2">{log.approver}</td>
                      <td className="px-3 py-2">{log.status}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatLogTime(log.time)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout
      sidebar={<DashboardSidebar items={employeeSidebarItems} />}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Expenses
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Add rows in the table, or upload a receipt in the popup to scan and
            edit before saving.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Card className="border-white/10 bg-neutral-950/70">
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-amber-200/90">To submit</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {sums.draft.toLocaleString()}{" "}
                <span className="text-sm font-normal text-gray-500">
                  {baseCurrency}
                </span>
              </p>
              <p className="text-[11px] text-gray-600">Draft total</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-neutral-950/70">
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-cyan-200/90">
                Waiting approval
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {sums.pending.toLocaleString()}{" "}
                <span className="text-sm font-normal text-gray-500">
                  {baseCurrency}
                </span>
              </p>
              <p className="text-[11px] text-gray-600">Submitted total</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-neutral-950/70">
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-emerald-200/90">Approved</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {sums.approved.toLocaleString()}{" "}
                <span className="text-sm font-normal text-gray-500">
                  {baseCurrency}
                </span>
              </p>
              <p className="text-[11px] text-gray-600">Paid / cleared</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/10 bg-neutral-950/70">
          <CardHeader className="flex flex-col gap-3 border-b border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-semibold text-white">
              Your expenses
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={openUploadDialog}
            >
              <Upload className="size-3.5" />
              Upload receipt
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {isPartialData && (
              <div className="mx-4 mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Server expenses could not be loaded. Showing local draft data only.
              </div>
            )}
            <input
              ref={attachDraftRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={handleDraftAttach}
            />

            {/* ═══ MOBILE CARD LAYOUT (< lg) ═══ */}
            <div className="space-y-3 px-4 py-3 lg:hidden">
              {/* Mobile composer */}
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">New expense</p>
                <Input
                  placeholder="Description"
                  value={composer.description}
                  onChange={(e) => setComposer((c) => ({ ...c, description: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={composer.expenseDate}
                    onChange={(e) => setComposer((c) => ({ ...c, expenseDate: e.target.value }))}
                  />
                  <Select
                    value={composer.category}
                    onChange={(e) => setComposer((c) => ({ ...c, category: e.target.value }))}
                  >
                    {EXPENSE_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={composer.paidBy}
                    onChange={(e) => setComposer((c) => ({ ...c, paidBy: e.target.value }))}
                  >
                    {PAID_BY_OPTIONS.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </Select>
                  <Input
                    placeholder="Remarks"
                    value={composer.remarks}
                    onChange={(e) => setComposer((c) => ({ ...c, remarks: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount"
                    className="flex-1"
                    value={composer.amount}
                    onChange={(e) => setComposer((c) => ({ ...c, amount: e.target.value }))}
                  />
                  <Select
                    className="w-24 shrink-0"
                    value={composer.currencyCode}
                    onChange={(e) => setComposer((c) => ({ ...c, currencyCode: e.target.value }))}
                  >
                    {CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </Select>
                </div>
                <Button type="button" className="w-full" onClick={handleAddFromComposer}>
                  Add expense
                </Button>
              </div>

              {/* Mobile expense cards */}
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
              ) : rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No saved expenses yet — use the form above or Upload receipt.</p>
              ) : (
                rows.map((r) => {
                  const isDraft = r.status === "draft";
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "rounded-xl border p-4 space-y-3 transition-all duration-200",
                        isDraft
                          ? "border-white/10 bg-neutral-950/60 hover:border-cyan-500/20"
                          : "border-white/10 bg-neutral-950/60 hover:border-cyan-500/20 cursor-pointer"
                      )}
                      onClick={!isDraft ? () => setViewId(r.id) : undefined}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{r.description || "—"}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{r.employeeName || employeeName} · {formatDate(r.expenseDate)}</p>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">{r.category}</span>
                          <span className="text-xs text-gray-600">{r.paidBy}</span>
                        </div>
                        <p className="text-sm font-semibold text-white">
                          {Number(r.amount) || 0}{" "}
                          <span className="text-xs font-normal text-gray-500">{r.currencyCode}</span>
                        </p>
                      </div>
                      {isDraft && (
                        <div className="flex gap-2 border-t border-white/5 pt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              attachDraftIdRef.current = r.id;
                              attachDraftRef.current?.click();
                            }}
                          >
                            <Paperclip className="size-3.5" />
                            Attach
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1.5 flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              submitRow(r.id);
                            }}
                          >
                            <Wallet className="size-3.5" />
                            Submit
                          </Button>
                        </div>
                      )}
                      {!isDraft && (
                        <div className="flex justify-end border-t border-white/5 pt-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs text-cyan-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewId(r.id);
                            }}
                          >
                            <Eye className="size-3.5" />
                            View details
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* ═══ DESKTOP TABLE LAYOUT (lg+) ═══ */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-500">
                    <th className="px-3 py-2 font-medium">Employee</th>
                    <th className="min-w-[120px] px-3 py-2 font-medium">
                      Description
                    </th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="min-w-[88px] px-3 py-2 font-medium">
                      Category
                    </th>
                    <th className="min-w-[88px] px-3 py-2 font-medium">
                      Paid by
                    </th>
                    <th className="min-w-[88px] px-3 py-2 font-medium">
                      Remarks
                    </th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="w-[120px] px-3 py-2 font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-cyan-500/20 bg-cyan-500/5">
                    <td className="px-3 py-2 align-middle text-gray-300">
                      {employeeName}
                    </td>
                    <td className="px-3 py-1.5 align-middle">
                      <input
                        className={cn(cellInput, "w-full max-w-[160px]")}
                        placeholder="Description"
                        value={composer.description}
                        onChange={(e) =>
                          setComposer((c) => ({
                            ...c,
                            description: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-1.5 align-middle">
                      <input
                        type="date"
                        className={cn(cellInput, "w-[128px]")}
                        value={composer.expenseDate}
                        onChange={(e) =>
                          setComposer((c) => ({
                            ...c,
                            expenseDate: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-1.5 align-middle">
                      <select
                        className={cn(cellInput, "w-full min-w-[84px]")}
                        value={composer.category}
                        onChange={(e) =>
                          setComposer((c) => ({
                            ...c,
                            category: e.target.value,
                          }))
                        }
                      >
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 align-middle">
                      <select
                        className={cn(cellInput, "w-full min-w-[84px]")}
                        value={composer.paidBy}
                        onChange={(e) =>
                          setComposer((c) => ({
                            ...c,
                            paidBy: e.target.value,
                          }))
                        }
                      >
                        {PAID_BY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5 align-middle">
                      <input
                        className={cn(cellInput, "w-full max-w-[100px]")}
                        placeholder="—"
                        value={composer.remarks}
                        onChange={(e) =>
                          setComposer((c) => ({
                            ...c,
                            remarks: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-1.5 align-middle">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={cn(cellInput, "w-[72px]")}
                          placeholder="0"
                          value={composer.amount}
                          onChange={(e) =>
                            setComposer((c) => ({
                              ...c,
                              amount: e.target.value,
                            }))
                          }
                        />
                        <select
                          className={cn(cellInput, "w-[62px] shrink-0 px-1")}
                          value={composer.currencyCode}
                          onChange={(e) =>
                            setComposer((c) => ({
                              ...c,
                              currencyCode: e.target.value,
                            }))
                          }
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle text-gray-600">—</td>
                    <td className="px-3 py-1.5 align-middle text-right">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={handleAddFromComposer}
                      >
                        Add expense
                      </Button>
                    </td>
                  </tr>

                  {loading ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-10 text-center text-gray-500"
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const isDraft = r.status === "draft";
                      if (isDraft) {
                        return (
                          <tr
                            key={r.id}
                            className="border-b border-white/5 hover:bg-white/[0.03]"
                          >
                            <td className="px-3 py-1.5 align-middle text-gray-300">
                              {r.employeeName || employeeName}
                            </td>
                            <td className="px-3 py-1.5 align-middle">
                              <input
                                className={cn(cellInput, "w-full max-w-[160px]")}
                                value={r.description}
                                onChange={(e) =>
                                  persistPatch(r.id, {
                                    description: e.target.value,
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-1.5 align-middle">
                              <input
                                type="date"
                                className={cn(cellInput, "w-[128px]")}
                                value={r.expenseDate?.slice(0, 10) || ""}
                                onChange={(e) =>
                                  persistPatch(r.id, {
                                    expenseDate: e.target.value,
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-1.5 align-middle">
                              <select
                                className={cn(cellInput, "w-full min-w-[84px]")}
                                value={r.category}
                                onChange={(e) =>
                                  persistPatch(r.id, {
                                    category: e.target.value,
                                  })
                                }
                              >
                                {EXPENSE_CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-1.5 align-middle">
                              <select
                                className={cn(cellInput, "w-full min-w-[84px]")}
                                value={r.paidBy}
                                onChange={(e) =>
                                  persistPatch(r.id, {
                                    paidBy: e.target.value,
                                  })
                                }
                              >
                                {PAID_BY_OPTIONS.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-1.5 align-middle">
                              <input
                                className={cn(cellInput, "w-full max-w-[100px]")}
                                value={r.remarks}
                                onChange={(e) =>
                                  persistPatch(r.id, {
                                    remarks: e.target.value,
                                  })
                                }
                              />
                            </td>
                            <td className="px-3 py-1.5 align-middle">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className={cn(cellInput, "w-[72px]")}
                                  value={
                                    r.amount === "" || r.amount == null
                                      ? ""
                                      : r.amount
                                  }
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    persistPatch(r.id, {
                                      amount:
                                        v === "" ? "" : Number(v),
                                    });
                                  }}
                                />
                                <select
                                  className={cn(
                                    cellInput,
                                    "w-[62px] shrink-0 px-1"
                                  )}
                                  value={r.currencyCode}
                                  onChange={(e) =>
                                    persistPatch(r.id, {
                                      currencyCode: e.target.value,
                                    })
                                  }
                                >
                                  {CURRENCIES.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 align-middle">
                              <StatusBadge status={r.status} />
                            </td>
                            <td className="px-3 py-1.5 align-middle text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2"
                                  title="Attach receipt"
                                  onClick={() => {
                                    attachDraftIdRef.current = r.id;
                                    attachDraftRef.current?.click();
                                  }}
                                >
                                  <Paperclip className="size-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 gap-0.5 px-2 text-[11px]"
                                  onClick={() => submitRow(r.id)}
                                >
                                  <Wallet className="size-3.5" />
                                  Submit
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr
                          key={r.id}
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer border-b border-white/5 hover:bg-white/5"
                          onClick={() => setViewId(r.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setViewId(r.id);
                            }
                          }}
                        >
                          <td className="px-3 py-2.5 text-gray-300">
                            {r.employeeName || employeeName}
                          </td>
                          <td className="max-w-[160px] truncate px-3 py-2.5 text-gray-200">
                            {r.description || "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-gray-400">
                            {formatDate(r.expenseDate)}
                          </td>
                          <td className="px-3 py-2.5 text-gray-400">
                            {r.category}
                          </td>
                          <td className="px-3 py-2.5 text-gray-400">
                            {r.paidBy}
                          </td>
                          <td className="max-w-[100px] truncate px-3 py-2.5 text-gray-500">
                            {r.remarks || "None"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-medium text-white">
                            {Number(r.amount) || 0}{" "}
                            <span className="text-gray-500">
                              {r.currencyCode}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-[11px] text-cyan-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewId(r.id);
                              }}
                            >
                              <Eye className="size-3.5" />
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {!loading && rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-6 text-center text-gray-500"
                      >
                        No saved expenses yet — use the row above or Upload
                        receipt.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent
          showCloseButton
          className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-lg"
        >
          <DialogHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
            <DialogTitle className="text-white">Attach receipt</DialogTitle>
            <WorkflowStepper status="draft" />
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={handleReceiptInDialog}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadParsing}
                onClick={() => receiptInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="size-3.5" />
                {uploadParsing ? "Scanning…" : "Choose receipt / photo"}
              </Button>
              {uploadForm.receiptFileName && (
                <span className="self-center text-xs text-gray-400">
                  {uploadForm.receiptFileName}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              The demo scan only suggests a title from the file name. Enter the
              amount yourself so it is never changed automatically.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-gray-300">Description</Label>
                <Input
                  value={uploadForm.description}
                  onChange={(e) =>
                    setUploadForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Short description"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Expense date</Label>
                <Input
                  type="date"
                  value={uploadForm.expenseDate}
                  onChange={(e) =>
                    setUploadForm((f) => ({
                      ...f,
                      expenseDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Category</Label>
                <Select
                  value={uploadForm.category}
                  onChange={(e) =>
                    setUploadForm((f) => ({
                      ...f,
                      category: e.target.value,
                    }))
                  }
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Paid by</Label>
                <Select
                  value={uploadForm.paidBy}
                  onChange={(e) =>
                    setUploadForm((f) => ({
                      ...f,
                      paidBy: e.target.value,
                    }))
                  }
                >
                  {PAID_BY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c === "Self" ? `${employeeName} (self)` : c}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-gray-300">Total amount</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="sm:max-w-[200px]"
                    value={uploadForm.amount}
                    onChange={(e) =>
                      setUploadForm((f) => ({
                        ...f,
                        amount: e.target.value,
                      }))
                    }
                  />
                  <Select
                    className="sm:max-w-[120px]"
                    value={uploadForm.currencyCode}
                    onChange={(e) =>
                      setUploadForm((f) => ({
                        ...f,
                        currencyCode: e.target.value,
                      }))
                    }
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-gray-300">Remarks</Label>
                <Input
                  value={uploadForm.remarks}
                  onChange={(e) =>
                    setUploadForm((f) => ({ ...f, remarks: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-gray-300">Detailed description</Label>
                <Textarea
                  value={uploadForm.detailedDescription}
                  onChange={(e) =>
                    setUploadForm((f) => ({
                      ...f,
                      detailedDescription: e.target.value,
                    }))
                  }
                  placeholder="Notes…"
                  className="min-h-[88px] border-white/10 bg-black/40 text-white placeholder:text-gray-600 focus-visible:border-cyan-500/50 focus-visible:ring-cyan-400/35"
                />
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/30">
              <div className="border-b border-white/10 px-3 py-2 text-xs font-medium text-gray-400">
                Approval history
              </div>
              <p className="px-3 py-4 text-center text-xs text-gray-600">
                Entries appear after you submit
              </p>
            </div>

            <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={saveUploadDraftToTable}
              >
                Save draft to table
              </Button>
              <Button
                type="button"
                onClick={submitUploadDialog}
                className="gap-2"
              >
                <Wallet className="size-4" />
                Submit for approval
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewId)} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent
          showCloseButton
          className="max-h-[90vh] max-w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="text-white">Expense detail</DialogTitle>
          </DialogHeader>
          {renderViewDialogBody()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
