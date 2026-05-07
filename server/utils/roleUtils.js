const ALLOWED = new Set(["admin", "manager", "employee"]);
const PRIORITY = { admin: 3, manager: 2, employee: 1 };

function normalizeRoles(input) {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  return [
    ...new Set(
      arr
        .map((r) => String(r || "").toLowerCase().trim())
        .filter((r) => ALLOWED.has(r)),
    ),
  ];
}

function primaryRole(roles) {
  const n = normalizeRoles(roles);
  if (!n.length) return "employee";
  return [...n].sort((a, b) => (PRIORITY[b] || 0) - (PRIORITY[a] || 0))[0];
}

function rolesFromUserRow(user) {
  if (!user) return [];
  const raw = user.roles;
  if (Array.isArray(raw) && raw.length) return normalizeRoles(raw);
  if (user.role) return normalizeRoles([user.role]);
  return [];
}

function tokenRolesPayload(user) {
  const list = rolesFromUserRow(user);
  const primary = primaryRole(list);
  return { role: primary, roles: list.length ? list : [primary] };
}

function userHasAnyRole(tokenUser, allowedList) {
  if (!tokenUser || !Array.isArray(allowedList)) return false;
  const list = tokenUser.roles?.length
    ? normalizeRoles(tokenUser.roles)
    : normalizeRoles([tokenUser.role]);
  return list.some((r) => allowedList.includes(r));
}

module.exports = {
  normalizeRoles,
  primaryRole,
  rolesFromUserRow,
  tokenRolesPayload,
  userHasAnyRole,
};
