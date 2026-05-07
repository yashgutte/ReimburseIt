import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import DashboardLayout from "../../components/layout/DashboardLayout";
import DashboardSidebar from "../../components/layout/DashboardSidebar";
import { managerSidebarItems } from "../../lib/dashboard-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fetchPendingApprovals,
  approveExpense,
  rejectExpense,
  absoluteReceiptUrl,
} from "../../services/MiddlePerson/ApprovalAPI";
import { FileImage, X } from "lucide-react";

function matchesSearch(row, q) {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  return [
    row.reviewerLabel,
    row.reviewerSubtext,
    row.requestOwner,
    row.category,
    row.status,
    String(row.amountInCompanyCurrency),
    row.amountOriginal,
  ]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(s));
}

/* ─── Rejection Modal ─── */
function RejectModal({ row, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      toast.error("A rejection reason is required.");
      return;
    }
    setSending(true);
    await onConfirm(reason.trim());
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md animate-in fade-in zoom-in-95 rounded-xl border border-white/10 bg-neutral-950/95 p-6 shadow-2xl">
        {/* close */}
        <button
          onClick={onCancel}
          className="absolute right-3 top-3 rounded-full p-1 text-gray-500 transition hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>

        <h3 className="text-lg font-semibold text-white">Reject expense</h3>
        <p className="mt-1 text-sm text-gray-400">
          Rejecting <span className="font-medium text-gray-200">{row.requestOwner}'s</span>{" "}
          <span className="text-gray-300">{row.category}</span> claim of{" "}
          <span className="font-medium text-red-400">{row.amountOriginal}</span>.
        </p>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500">
          Reason (sent to employee via email)
        </label>
        <textarea
          className="mt-1.5 h-28 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none transition focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20"
          placeholder="e.g. Missing receipt, amount exceeds policy limit…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            onClick={onCancel}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25 hover:text-red-200"
            onClick={submit}
            disabled={sending}
          >
            {sending ? "Rejecting…" : "Confirm rejection"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalDashboard() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null); // row for modal

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPendingApprovals();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetchPendingApprovals:", e);
      toast.error(
        e?.response?.data?.message ||
          e?.message ||
          "Could not load approvals.",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => rows.filter((r) => matchesSearch(r, search)),
    [rows, search],
  );

  const handleApprove = async (row) => {
    const id = row.expenseId;
    if (!id) {
      toast.error("Missing expense id for this row.");
      return;
    }
    setActingId(id);
    try {
      await approveExpense(id);
      toast.success("Expense approved.");
      await load();
    } catch (e) {
      toast.error(
        e?.response?.data?.message ||
          e?.message ||
          "Could not approve.",
      );
    } finally {
      setActingId(null);
    }
  };

  const openRejectModal = (row) => {
    const id = row.expenseId;
    if (!id) {
      toast.error("Missing expense id for this row.");
      return;
    }
    setRejectTarget(row);
  };

  const confirmReject = async (reason) => {
    const row = rejectTarget;
    if (!row) return;
    const id = row.expenseId;
    setActingId(id);
    try {
      await rejectExpense(id, reason);
      toast.success("Expense rejected.");
      setRejectTarget(null);
      await load();
    } catch (e) {
      toast.error(
        e?.response?.data?.message ||
          e?.message ||
          "Could not reject.",
      );
    } finally {
      setActingId(null);
    }
  };

  return (
    <DashboardLayout
      sidebar={<DashboardSidebar items={managerSidebarItems} />}
    >
      <div className="text-gray-100">
        {/* ── Rejection modal ── */}
        {rejectTarget && (
          <RejectModal
            row={rejectTarget}
            onConfirm={confirmReject}
            onCancel={() => setRejectTarget(null)}
          />
        )}

        <Card className="mx-auto max-w-7xl border-white/10 bg-neutral-950/70 shadow-glow-inset backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/20">
          <CardHeader className="border-b border-white/10 pb-4">
            <CardTitle className="text-xl font-bold tracking-tight text-white">
              Approvals to review
            </CardTitle>
            <p className="text-sm text-gray-500">
              Pending items assigned to you based on company approval rules.
            </p>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <Input
              type="search"
              placeholder="Search by owner, category, status, amount…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 max-w-2xl"
            />

            {/* ═══ MOBILE CARD LAYOUT (< lg) ═══ */}
            <div className="space-y-3 lg:hidden">
              {loading && (
                <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
              )}
              {!loading && filtered.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-500">No pending approvals.</p>
              )}
              {!loading &&
                filtered.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3 transition-all duration-200 hover:border-cyan-500/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Badge
                          className={cn(
                            "mb-1 border-0 px-2.5 py-1 text-xs font-medium text-white shadow-sm",
                            "bg-violet-600 hover:bg-violet-600"
                          )}
                        >
                          {row.reviewerLabel}
                        </Badge>
                        <p className="text-[11px] text-gray-500">{row.reviewerSubtext}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-200">
                        ₹{row.amountInCompanyCurrency}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-gray-500">Owner:</span>{" "}
                        <span className="text-gray-200">{row.requestOwner}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Category:</span>{" "}
                        <span className="text-gray-200">{row.category}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>{" "}
                        <span className="text-gray-200">{row.status}</span>
                      </div>
                      <div>
                        {row.receiptUrl ? (
                          <a
                            href={absoluteReceiptUrl(row.receiptUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline"
                          >
                            <FileImage className="size-3.5 shrink-0" />
                            View receipt
                          </a>
                        ) : (
                          <span className="text-gray-600">No receipt</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 border-t border-white/5 pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
                        disabled={actingId === row.expenseId}
                        onClick={() => handleApprove(row)}
                      >
                        {actingId === row.expenseId ? "…" : "Approve"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-full border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                        disabled={actingId === row.expenseId}
                        onClick={() => openRejectModal(row)}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
            </div>

            {/* ═══ DESKTOP TABLE LAYOUT (lg+) ═══ */}
            <div
              className="hidden lg:block overflow-x-auto rounded-lg border border-white/10 bg-black/30"
              aria-busy={loading}
            >
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th
                      className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                      scope="col"
                    >
                      &nbsp;
                    </th>
                    <th
                      className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                      scope="col"
                    >
                      Request Owner
                    </th>
                    <th
                      className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                      scope="col"
                    >
                      Category
                    </th>
                    <th
                      className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                      scope="col"
                    >
                      Request Status
                    </th>
                    <th
                      className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                      scope="col"
                    >
                      Amount (₹)
                    </th>
                    <th
                      className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500"
                      scope="col"
                    >
                      Receipt
                    </th>
                    <th
                      className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500"
                      scope="col"
                      colSpan={2}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-gray-500"
                      >
                        No pending approvals.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    filtered.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-white/10 transition-colors last:border-b-0 hover:bg-white/[0.04]"
                      >
                        <td className="px-4 py-4 align-top">
                          <div className="inline-flex flex-col gap-1">
                            <Badge
                              className={cn(
                                "max-w-[11rem] justify-center border-0 px-3 py-1.5 text-center text-xs font-medium text-white shadow-sm",
                                "bg-violet-600 hover:bg-violet-600 focus-visible:ring-violet-500/40",
                              )}
                            >
                              {row.reviewerLabel}
                            </Badge>
                            <span className="text-[11px] text-gray-500">
                              {row.reviewerSubtext}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          {row.requestOwner}
                        </td>
                        <td className="px-4 py-4 align-top">{row.category}</td>
                        <td className="px-4 py-4 align-top">{row.status}</td>
                        <td className="px-4 py-4 align-top">
                          <span className="font-medium text-gray-200">
                            ₹{row.amountInCompanyCurrency}
                          </span>
                        </td>
                        <td className="px-3 py-4 align-top">
                          {row.receiptUrl ? (
                            <a
                              href={absoluteReceiptUrl(row.receiptUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 underline-offset-2 hover:text-cyan-300 hover:underline"
                            >
                              <FileImage className="size-3.5 shrink-0" />
                              View
                            </a>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-2 py-4 align-top">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
                            disabled={actingId === row.expenseId}
                            onClick={() => handleApprove(row)}
                          >
                            {actingId === row.expenseId ? "…" : "Approve"}
                          </Button>
                        </td>
                        <td className="px-2 py-4 align-top">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                            disabled={actingId === row.expenseId}
                            onClick={() => openRejectModal(row)}
                          >
                            Reject
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
