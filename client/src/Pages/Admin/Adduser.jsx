/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fetchDirectoryUsers,
  sendUserPasswordInvite,
} from "@/services/admin/usersApi";
import DashboardLayout from "../../components/layout/DashboardLayout";
import DashboardSidebar from "../../components/layout/DashboardSidebar";
import { adminSidebarItems } from "../../lib/dashboard-nav";

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const emptyRow = () => ({
  key: newKey(),
  userName: "",
  userId: null,
  role: "employee",
  managerName: "",
  managerId: null,
  managerEmail: "",
  email: "",
});

const selectClass = cn(
  "flex h-8 w-full min-w-0 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-sm text-white",
  "outline-none transition-all duration-200 focus-visible:border-cyan-500/50 focus-visible:ring-3 focus-visible:ring-cyan-400/35"
);

function SearchablePerson({
  value,
  onPick,
  directory,
  onlyRole,
  placeholder,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const options = useMemo(() => {
    let list = directory;
    if (onlyRole === "manager") {
      list = directory.filter(
        (u) =>
          u.role === "manager" ||
          (Array.isArray(u.roles) && u.roles.includes("manager")),
      );
    } else if (onlyRole) {
      list = directory.filter((u) => u.role === onlyRole);
    }
    const q = value.trim().toLowerCase();
    if (!q) return list.slice(0, 10);
    return list
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [directory, value, onlyRole]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const exact = directory.some(
    (u) => u.name.toLowerCase() === value.trim().toLowerCase()
  );
  const canCreate = value.trim().length >= 2 && !exact;

  return (
    <div className="relative min-w-[160px]" ref={wrapRef}>
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          onPick({ name: e.target.value, id: null });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="h-8 bg-background"
        autoComplete="off"
      />
      {open && (
        <ul
          className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md ring-1 ring-foreground/10"
          role="listbox"
        >
          {options.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left hover:bg-accent"
                onClick={() => {
                  onPick({ name: u.name, id: u.id });
                  setOpen(false);
                }}
              >
                <span className="font-medium">{u.name}</span>
                <span className="ml-2 text-muted-foreground">{u.email}</span>
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left text-primary hover:bg-accent"
                onClick={() => {
                  onPick({ name: value.trim(), id: null });
                  setOpen(false);
                }}
              >
                Create &quot;{value.trim()}&quot;
              </button>
            </li>
          )}
          {!options.length && !canCreate && value.trim() && (
            <li className="px-2 py-2 text-muted-foreground">No matches</li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function Adduser() {
  const [rows, setRows] = useState(() => [emptyRow()]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [sendingKey, setSendingKey] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const list = await fetchDirectoryUsers();
      setUsers(Array.isArray(list) ? list : []);
    } catch {
      setUsers([]);
      toast.error("Could not load users.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const updateRow = useCallback((key, patch) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }, []);

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const emailOk = (email) => /\S+@\S+\.\S+/.test(email.trim());

  const handleSendPassword = async (row) => {
    if (!row.userName.trim()) {
      toast.error("Enter a user name.");
      return;
    }
    if (!emailOk(row.email)) {
      toast.error("Enter a valid email.");
      return;
    }
    const role = (row.role || "employee").toLowerCase();
    if (!["employee", "manager", "admin"].includes(role)) {
      toast.error("Select a valid role.");
      return;
    }
    setSendingKey(row.key);
    try {
      const result = await sendUserPasswordInvite({
        userName: row.userName.trim(),
        userId: row.userId,
        email: row.email.trim().toLowerCase(),
        role,
        managerName: row.managerName.trim() || undefined,
        managerId: row.managerId,
        managerEmail: row.managerEmail.trim() || undefined,
        createUserIfNew: !row.userId,
        createManagerIfNew: Boolean(
          role === "employee" && row.managerName.trim() && !row.managerId,
        ),
      });
      const inner = result?.data ?? result;
      const emailSent = inner?.emailSent === true;
      const parts = [];
      if (inner?.temporaryPassword) {
        parts.push(`User temp password: ${inner.temporaryPassword}`);
      }
      if (inner?.managerTemporaryPassword) {
        parts.push(`Manager temp password: ${inner.managerTemporaryPassword}`);
      }
      if (emailSent) {
        toast.success(
          result?.message ||
            inner?.message ||
            "Credentials sent by email.",
        );
      } else if (parts.length > 0) {
        toast.success(parts.join(" · "));
      } else {
        toast.success(
          result?.message ||
            "Done. Configure SMTP on the server to email credentials automatically.",
        );
      }
      await loadUsers();
    } catch (e) {
      toast.error(
        e?.response?.data?.message ||
          e?.message ||
          "Could not send password email."
      );
    } finally {
      setSendingKey(null);
    }
  };

  return (
    <DashboardLayout sidebar={<DashboardSidebar items={adminSidebarItems} />}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <Card className="border border-white/10 bg-neutral-950/70 shadow-glow-inset ring-0 backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/20">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <CardTitle className="text-xl font-bold text-white">
                Users
              </CardTitle>
              <p className="mt-1 text-sm text-gray-400">
                Add people, assign roles and manager, then send login
                credentials by email (when SMTP is configured).
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="shadow-glow-sm"
              onClick={addRow}
            >
              New
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingUsers && (
              <p className="mb-4 text-sm text-gray-500">Loading directory…</p>
            )}

            {/* ═══ MOBILE CARD LAYOUT (< lg) ═══ */}
            <div className="space-y-4 lg:hidden">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3"
                >
                  <div className="space-y-2">
                    <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">User (name)</label>
                    <SearchablePerson
                      value={row.userName}
                      onPick={({ name, id }) =>
                        updateRow(row.key, { userName: name, userId: id })
                      }
                      directory={users}
                      onlyRole={null}
                      placeholder="Search or create…"
                      disabled={!!sendingKey}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Role</label>
                      <select
                        className={selectClass}
                        value={row.role}
                        disabled={!!sendingKey}
                        onChange={(e) => {
                          const next = e.target.value;
                          updateRow(row.key, {
                            role: next,
                            ...(next === "manager" || next === "admin"
                              ? { managerName: "", managerId: null, managerEmail: "" }
                              : {}),
                          });
                        }}
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Email</label>
                      <Input
                        type="email"
                        className="h-8"
                        placeholder="marc@gmail.com"
                        value={row.email}
                        disabled={!!sendingKey}
                        onChange={(e) => updateRow(row.key, { email: e.target.value })}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Manager</label>
                    <SearchablePerson
                      value={row.managerName}
                      onPick={({ name, id }) =>
                        updateRow(row.key, {
                          managerName: name,
                          managerId: id,
                          managerEmail: id ? "" : row.managerEmail,
                        })
                      }
                      directory={users}
                      onlyRole="manager"
                      placeholder="Manager…"
                      disabled={!!sendingKey || row.role !== "employee"}
                    />
                    {row.role === "employee" &&
                      !row.managerId &&
                      row.managerName.trim().length >= 2 && (
                        <Input
                          type="email"
                          className="h-7 text-xs"
                          placeholder="New manager email (if creating)"
                          value={row.managerEmail}
                          disabled={!!sendingKey}
                          onChange={(e) =>
                            updateRow(row.key, { managerEmail: e.target.value })
                          }
                          autoComplete="off"
                        />
                      )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!!sendingKey}
                    onClick={() => handleSendPassword(row)}
                  >
                    {sendingKey === row.key ? "Sending…" : "Send password"}
                  </Button>
                </div>
              ))}
            </div>

            {/* ═══ DESKTOP TABLE LAYOUT (lg+) ═══ */}
            <div className="hidden lg:block overflow-x-auto rounded-lg border border-white/10 bg-black/30">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      User (name)
                    </th>
                    <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Role
                    </th>
                    <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Manager
                    </th>
                    <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Email
                    </th>
                    <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-white/10 text-gray-200 last:border-b-0"
                    >
                      <td className="px-3 py-3 align-top">
                        <SearchablePerson
                          value={row.userName}
                          onPick={({ name, id }) =>
                            updateRow(row.key, { userName: name, userId: id })
                          }
                          directory={users}
                          onlyRole={null}
                          placeholder="Search or create…"
                          disabled={!!sendingKey}
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <select
                          className={selectClass}
                          value={row.role}
                          disabled={!!sendingKey}
                          onChange={(e) => {
                            const next = e.target.value;
                            updateRow(row.key, {
                              role: next,
                              ...(next === "manager" || next === "admin"
                                ? {
                                    managerName: "",
                                    managerId: null,
                                    managerEmail: "",
                                  }
                                : {}),
                            });
                          }}
                        >
                          <option value="employee">Employee</option>
                          <option value="manager">Manager</option>
                          <option value="Director">Director</option>
                          <option value="Team Lead">Team Lead</option>
                          <option value="CFO">CFO</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="space-y-1.5">
                          <SearchablePerson
                            value={row.managerName}
                            onPick={({ name, id }) =>
                              updateRow(row.key, {
                                managerName: name,
                                managerId: id,
                                managerEmail: id ? "" : row.managerEmail,
                              })
                            }
                            directory={users}
                            onlyRole="manager"
                            placeholder="Manager…"
                            disabled={!!sendingKey || row.role !== "employee"}
                          />
                          {row.role === "employee" &&
                            !row.managerId &&
                            row.managerName.trim().length >= 2 && (
                              <Input
                                type="email"
                                className="h-7 text-xs"
                                placeholder="New manager email (if creating)"
                                value={row.managerEmail}
                                disabled={!!sendingKey}
                                onChange={(e) =>
                                  updateRow(row.key, {
                                    managerEmail: e.target.value,
                                  })
                                }
                                autoComplete="off"
                              />
                            )}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Input
                          type="email"
                          className="h-8"
                          placeholder="marc@gmail.com"
                          value={row.email}
                          disabled={!!sendingKey}
                          onChange={(e) =>
                            updateRow(row.key, { email: e.target.value })
                          }
                          autoComplete="off"
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!!sendingKey}
                          onClick={() => handleSendPassword(row)}
                        >
                          {sendingKey === row.key
                            ? "Sending…"
                            : "Send password"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-neutral-950/70 shadow-glow-inset backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/25">
          <CardHeader className="border-b border-white/10 pb-4">
            <CardTitle className="text-xl font-bold text-white">
              Company users
            </CardTitle>
            <p className="text-sm text-gray-400">
              Everyone in your organization (same company as your admin
              account).
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingUsers ? (
              <p className="text-sm text-gray-500">Loading users…</p>
            ) : (
              <>
                {/* ═══ MOBILE CARD LAYOUT (< lg) ═══ */}
                <div className="space-y-3 lg:hidden">
                  {users.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500">No users in this company yet.</p>
                  ) : (
                    users.map((u) => (
                      <div
                        key={u.id}
                        className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-1"
                      >
                        <p className="text-sm font-medium text-white">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-gray-300">
                            {Array.isArray(u.roles) && u.roles.length
                              ? u.roles.join(", ")
                              : u.role}
                          </span>
                          <span className="text-xs text-gray-500">
                            {u.managerName ? `Mgr: ${u.managerName}` : "—"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ═══ DESKTOP TABLE LAYOUT (lg+) ═══ */}
                <div className="hidden lg:block overflow-x-auto rounded-lg border border-white/10 bg-black/30">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.03]">
                        <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Name
                        </th>
                        <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Email
                        </th>
                        <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Role
                        </th>
                        <th className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                          Manager
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-6 text-center text-gray-500"
                          >
                            No users in this company yet.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
                          <tr
                            key={u.id}
                            className="border-b border-white/10 text-gray-200 last:border-b-0"
                          >
                            <td className="px-3 py-3 font-medium">{u.name}</td>
                            <td className="px-3 py-3 text-gray-400">{u.email}</td>
                            <td className="px-3 py-3 text-gray-300">
                              {Array.isArray(u.roles) && u.roles.length
                                ? u.roles.join(", ")
                                : u.role}
                            </td>
                            <td className="px-3 py-3 text-gray-400">
                              {u.managerName ? (
                                <>
                                  <span>{u.managerName}</span>
                                  {u.managerEmail ? (
                                    <span className="mt-0.5 block text-xs text-gray-500">
                                      {u.managerEmail}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
