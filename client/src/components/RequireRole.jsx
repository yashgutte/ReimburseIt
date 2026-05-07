import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getHomePathForRole } from "../lib/dashboard-nav";

export function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }
  return children;
}

function userHasAllowedRole(user, allowed) {
  const list =
    user?.roles?.length > 0 ? user.roles : [user?.role].filter(Boolean);
  return list.some((r) => allowed.includes(r));
}

export function RequireRole({ roles, children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }
  if (!userHasAllowedRole(user, roles)) {
    return (
      <Navigate
        to={getHomePathForRole(user?.role, user?.roles)}
        replace
      />
    );
  }
  return children;
}
