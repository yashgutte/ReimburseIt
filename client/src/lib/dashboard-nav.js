import {
  Users,
  //Building2,
  CheckSquare,
  Receipt,
  GitBranch,
} from "lucide-react";

export const adminSidebarItems = [
  { to: "/admin/users", label: "Users", icon: Users },
  //{ to: "/admin/company/new", label: "Company", icon: Building2 },
  { to: "/admin/approval-rules", label: "Approval rules", icon: GitBranch },
];

export const managerSidebarItems = [
  { to: "/manager/approvals", label: "Approvals", icon: CheckSquare },
];

export const employeeSidebarItems = [
  { to: "/user/expenses", label: "Expenses", icon: Receipt },
];

export function getHomePathForRole(role, roles) {
  const list = Array.isArray(roles) && roles.length ? roles : [role].filter(Boolean);
  if (list.includes("admin")) return "/admin/users";
  if (list.includes("manager")) return "/manager/approvals";
  if (list.includes("employee")) return "/user/expenses";
  return "/";
}

export function getSidebarItemsForRole(role, roles) {
  const list = Array.isArray(roles) && roles.length ? roles : [role].filter(Boolean);
  if (list.includes("admin")) return adminSidebarItems;
  if (list.includes("manager")) return managerSidebarItems;
  return employeeSidebarItems;
}
