import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  Shield,
  Info,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import DashboardSidebar from "../../components/layout/DashboardSidebar";
import { adminSidebarItems } from "../../lib/dashboard-nav";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  emptyRuleForm,
  listApprovalRules,
  upsertApprovalRule,
  deleteApprovalRule,
  RULE_TYPE_OPTIONS,
  uid,
} from "@/services/admin/approvalRulesService";
import { EXPENSE_CATEGORIES } from "@/services/expenseService";

const RULE_SCOPE_CATEGORIES = ["All", ...EXPENSE_CATEGORIES];
import { fetchDirectoryUsers } from "@/services/admin/usersApi";

const selectClass = cn(
  "flex h-8 w-full min-w-0 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-sm text-white",
  "outline-none transition-all duration-200 focus-visible:border-cyan-500/50 focus-visible:ring-3 focus-visible:ring-cyan-400/35",
);

const checkboxClass =
  "size-4 shrink-0 rounded border-white/20 bg-black/50 text-cyan-500 focus:ring-2 focus:ring-cyan-500/40 focus:ring-offset-0 focus:ring-offset-neutral-950";

const FALLBACK_USERS = [
  { id: "demo-1", name: "Marc", email: "marc@demo.local", role: "employee" },
  { id: "demo-2", name: "Sarah", email: "sarah@demo.local", role: "manager" },
  { id: "demo-3", name: "John", email: "john@demo.local", role: "manager" },
  { id: "demo-4", name: "Mitchell", email: "mitch@demo.local", role: "employee" },
  { id: "demo-5", name: "Andreas", email: "andreas@demo.local", role: "employee" },
  { id: "demo-6", name: "CFO", email: "cfo@demo.local", role: "manager" },
];

function labelForRuleType(value) {
  return RULE_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;
}

export default function ApprovalRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [directory, setDirectory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyRuleForm);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listApprovalRules();
      setRules(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await fetchDirectoryUsers();
        if (!cancelled && u.length) setDirectory(u);
        else if (!cancelled) setDirectory(FALLBACK_USERS);
      } catch {
        if (!cancelled) setDirectory(FALLBACK_USERS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const managers = useMemo(
    () =>
      directory.filter(
        (u) => u.role === "manager" || u.role === "admin"
      ),
    [directory]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyRuleForm());
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      description: row.description || "",
      category: row.category || "All",
      subjectUserId: row.subjectUserId || "",
      managerId: row.managerId || "",
      ruleType: row.ruleType || "sequential",
      isManagerApprover: Boolean(row.isManagerApprover),
      approversSequence: Boolean(row.approversSequence),
      minApprovalPct:
        row.minApprovalPct != null ? Number(row.minApprovalPct) : 50,
      specificApproverId: row.specificApproverId || "",
      approvers: (row.approvers || [{ userId: "", required: true }]).map(
        (a) => ({
          rowId: a.rowId || uid(),
          userId: a.userId || "",
          required: Boolean(a.required),
        })
      ),
    });
    setShowForm(true);
  };

  const backToList = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyRuleForm());
  };

  const setField = (patch) => setForm((f) => ({ ...f, ...patch }));

  const addApproverRow = () => {
    setForm((f) => ({
      ...f,
      approvers: [
        ...f.approvers,
        { rowId: uid(), userId: "", required: false },
      ],
    }));
  };

  const removeApproverRow = (rowId) => {
    setForm((f) => ({
      ...f,
      approvers: f.approvers.filter((a) => a.rowId !== rowId),
    }));
  };

  const patchApprover = (rowId, patch) => {
    setForm((f) => ({
      ...f,
      approvers: f.approvers.map((a) =>
        a.rowId === rowId ? { ...a, ...patch } : a
      ),
    }));
  };

  const handleSubjectChange = (subjectUserId) => {
    const defaultMgr = managers[0]?.id || "";
    setField({
      subjectUserId,
      managerId: form.managerId || defaultMgr,
    });
  };

  const validate = () => {
    if (!form.name?.trim()) {
      toast.error("Add a short name / category for this rule.");
      return false;
    }
    if (!form.description?.trim()) {
      toast.error("Add a description.");
      return false;
    }
    if (form.ruleType === "percentage" || form.ruleType === "hybrid") {
      const p = Number(form.minApprovalPct);
      if (!Number.isFinite(p) || p < 1 || p > 100) {
        toast.error("Minimum approval % must be between 1 and 100.");
        return false;
      }
    }
    if (form.ruleType === "specific" || form.ruleType === "hybrid") {
      if (!form.specificApproverId) {
        toast.error("Select the required approver.");
        return false;
      }
    }
    const filledApprovers = form.approvers.filter((a) => a.userId);
    if (
      (form.ruleType === "sequential" ||
        form.ruleType === "percentage" ||
        form.ruleType === "all") &&
      filledApprovers.length === 0 &&
      !form.isManagerApprover
    ) {
      toast.error("Add at least one approver or enable manager as approver.");
      return false;
    }
    if (form.ruleType === "hybrid" && filledApprovers.length === 0) {
      toast.error(
        "Hybrid rules need at least one listed approver for the percentage side."
      );
      return false;
    }
    return true;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const names = (id) => directory.find((u) => u.id === id)?.name || "";
      const payload = {
        ...form,
        id: editingId || undefined,
        minApprovalPct:
          form.ruleType === "percentage" || form.ruleType === "hybrid"
            ? Number(form.minApprovalPct)
            : null,
        specificApproverId:
          form.ruleType === "specific" || form.ruleType === "hybrid"
            ? form.specificApproverId
            : null,
        subjectUserName: names(form.subjectUserId),
        managerName: names(form.managerId),
        specificApproverName: names(form.specificApproverId),
        approvers: form.approvers.map((a) => ({
          ...a,
          userName: names(a.userId),
        })),
      };
      await upsertApprovalRule(payload);
      toast.success(editingId ? "Rule updated." : "Rule saved.");
      await loadRules();
      backToList();
    } catch (err) {
      toast.error(err?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this approval rule?")) return;
    try {
      await deleteApprovalRule(id);
      toast.success("Rule removed.");
      await loadRules();
    } catch (err) {
      toast.error(err?.message || "Could not delete.");
    }
  };

  return (
    <DashboardLayout sidebar={<DashboardSidebar items={adminSidebarItems} />}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Approval rules
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Configure routing: sequential chain, percentage threshold,
              designated approver, hybrid OR logic, or all notified with any-one
              approval.
            </p>
          </div>
          {!showForm && (
            <Button type="button" className="gap-2" onClick={openCreate}>
              <Plus className="size-4" />
              New rule
            </Button>
          )}
        </div>

        {!showForm && (
          <Card className="border-white/10 bg-neutral-950/70">
            <CardHeader className="border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                <Shield className="size-4 text-cyan-400/90" />
                Saved rules
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-500">
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Category</th>
                      <th className="px-4 py-2 font-medium">Employee</th>
                      <th className="px-4 py-2 font-medium">Manager</th>
                      <th className="px-4 py-2 font-medium">Rule type</th>
                      <th className="px-4 py-2 font-medium text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          Loading…
                        </td>
                      </tr>
                    ) : rules.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          No rules yet. Create one to define approval behaviour.
                        </td>
                      </tr>
                    ) : (
                      rules.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-white/5 hover:bg-white/[0.03]"
                        >
                          <td className="px-4 py-2.5 font-medium text-gray-200">
                            {r.name}
                          </td>
                          <td className="px-4 py-2.5 text-gray-400">
                            {r.category || "All"}
                          </td>
                          <td className="px-4 py-2.5 text-gray-400">
                            {r.subjectUserName || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-gray-400">
                            {r.managerName || "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant="outline"
                              className="border-white/15 bg-white/5 text-gray-300"
                            >
                              {labelForRuleType(r.ruleType)}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-cyan-400"
                              onClick={() => openEdit(r)}
                            >
                              <Pencil className="size-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-rose-400/90"
                              onClick={() => handleDelete(r.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {showForm && (
          <form onSubmit={handleSave}>
            <div className="mb-4 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={backToList}
              >
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <span className="text-sm text-gray-500">
                {editingId ? "Edit rule" : "New rule"}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-white/10 bg-neutral-950/70">
                <CardHeader className="border-b border-white/10 pb-3">
                  <CardTitle className="text-base font-semibold text-white">
                    Rule scope
                  </CardTitle>
                  <p className="text-xs text-gray-500">
                    Who this policy applies to and how it is described.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setField({ name: e.target.value })}
                      placeholder="e.g. Miscellaneous expenses"
                      className="border-white/10 bg-black/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Description</Label>
                    <Input
                      value={form.description}
                      onChange={(e) =>
                        setField({ description: e.target.value })
                      }
                      placeholder="Approval rule for miscellaneous expenses"
                      className="border-white/10 bg-black/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Expense category</Label>
                    <select
                      className={selectClass}
                      value={form.category || "All"}
                      onChange={(e) => setField({ category: e.target.value })}
                    >
                      {RULE_SCOPE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c === "All"
                            ? "All categories"
                            : c}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500">
                      Matches the category employees select when submitting.
                      “All” applies unless a more specific rule scores higher.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">User (employee)</Label>
                    <select
                      className={selectClass}
                      value={form.subjectUserId}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                    >
                      <option value="">Select employee</option>
                      {directory.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                    <p className="flex gap-1 text-[11px] text-gray-500">
                      <Info className="size-3.5 shrink-0 text-gray-600" />
                      Leave empty to apply to every employee in the company (for
                      the chosen category). Otherwise pick one employee.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Manager</Label>
                    <select
                      className={selectClass}
                      value={form.managerId}
                      onChange={(e) =>
                        setField({ managerId: e.target.value })
                      }
                    >
                      <option value="">Select manager</option>
                      {managers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500">
                      Defaults from the employee record; you can override for
                      this rule.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-neutral-950/70">
                <CardHeader className="border-b border-white/10 pb-3">
                  <CardTitle className="text-base font-semibold text-white">
                    Rule type
                  </CardTitle>
                  <p className="text-xs text-gray-500">
                    Pick one model. Sequential can be combined with percentage or
                    hybrid at each stage in the full product.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {RULE_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        data-active={form.ruleType === opt.value}
                        onClick={() => setField({ ruleType: opt.value })}
                        className={cn(
                          "rounded-xl border px-3 py-3 text-left text-xs transition-all",
                          opt.accent,
                          opt.ring,
                          form.ruleType === opt.value
                            ? ""
                            : "opacity-80 hover:opacity-100"
                        )}
                      >
                        <span className="font-semibold text-white">
                          {opt.label}
                        </span>
                        <p className="mt-1 text-[11px] leading-snug text-gray-400">
                          {opt.hint}
                        </p>
                      </button>
                    ))}
                  </div>

                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 bg-black/30 p-3">
                    <input
                      type="checkbox"
                      className={cn(checkboxClass, "mt-0.5")}
                      checked={form.isManagerApprover}
                      onChange={(e) =>
                        setField({ isManagerApprover: e.target.checked })
                      }
                    />
                    <span>
                      <span className="text-sm font-medium text-gray-200">
                        Is manager an approver?
                      </span>
                      <span className="mt-0.5 block text-[11px] text-gray-500">
                        If checked, the request goes to the manager first before
                        other approvers.
                      </span>
                    </span>
                  </label>

                  {(form.ruleType === "percentage" ||
                    form.ruleType === "hybrid") && (
                    <div className="space-y-2">
                      <Label className="text-gray-300">
                        Minimum approval percentage
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          className="max-w-[120px] border-white/10 bg-black/40"
                          value={form.minApprovalPct}
                          onChange={(e) =>
                            setField({ minApprovalPct: e.target.value })
                          }
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Share of listed approvers (non-required) that must
                        approve for the step to pass.
                      </p>
                    </div>
                  )}

                  {(form.ruleType === "specific" ||
                    form.ruleType === "hybrid") && (
                    <div className="space-y-2">
                      <Label className="text-gray-300">
                        Required approver (specific)
                      </Label>
                      <select
                        className={selectClass}
                        value={form.specificApproverId}
                        onChange={(e) =>
                          setField({ specificApproverId: e.target.value })
                        }
                      >
                        <option value="">Select user</option>
                        {directory.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-gray-500">
                        This person must approve; for hybrid, either this
                        approval or the % threshold passes the rule.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4 border-white/10 bg-neutral-950/70">
              <CardHeader className="border-b border-white/10 pb-3">
                <CardTitle className="text-base font-semibold text-white">
                  Approvers
                </CardTitle>
                <label className="mt-3 flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className={cn(checkboxClass, "mt-0.5")}
                    checked={form.approversSequence}
                    onChange={(e) =>
                      setField({ approversSequence: e.target.checked })
                    }
                  />
                  <span>
                    <span className="text-sm font-medium text-gray-200">
                      Approvers sequence (sequential)
                    </span>
                    <span className="mt-0.5 block text-[11px] text-gray-500">
                      On: order matters — each step waits for the previous. Off:
                      requests go to everyone in parallel (for percentage /
                      parallel flows).
                    </span>
                  </span>
                </label>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <div className="overflow-x-auto rounded-lg border border-white/10">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-black/30 text-gray-500">
                        <th className="w-10 px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">User</th>
                        <th className="w-28 px-3 py-2 font-medium">Required</th>
                        <th className="w-12 px-2 py-2" aria-label="Remove row" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.approvers.map((row, idx) => (
                        <tr
                          key={row.rowId}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <select
                              className={cn(selectClass, "h-7 text-[11px]")}
                              value={row.userId}
                              onChange={(e) =>
                                patchApprover(row.rowId, {
                                  userId: e.target.value,
                                })
                              }
                            >
                              <option value="">Select user</option>
                              {directory.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <label className="flex items-center gap-2 text-gray-400">
                              <input
                                type="checkbox"
                                className={checkboxClass}
                                checked={row.required}
                                onChange={(e) =>
                                  patchApprover(row.rowId, {
                                    required: e.target.checked,
                                  })
                                }
                              />
                              Required
                            </label>
                          </td>
                          <td className="w-12 px-2 py-2 text-right">
                            {form.approvers.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-rose-400"
                                onClick={() => removeApproverRow(row.rowId)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={addApproverRow}
                >
                  <Plus className="size-3.5" />
                  Add approver row
                </Button>
              </CardContent>
            </Card>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={backToList}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="min-w-[120px]">
                {saving ? "Saving…" : editingId ? "Update rule" : "Save rule"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
