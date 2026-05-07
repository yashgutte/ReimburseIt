/* eslint-disable react/prop-types */
import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user } = useContext(AuthContext);

  if (isAuthenticated === false) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthenticated) {
    return <div className="min-h-screen grid place-items-center">Loading...</div>;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
