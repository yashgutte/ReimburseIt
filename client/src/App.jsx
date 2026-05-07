/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth, RequireRole } from "./components/RequireRole";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

import MainLayout from "./components/MainLayout";
import Home from "./Pages/Home";
import Login from "./Pages/Login";
import Adduser from "./Pages/Admin/Adduser";
import CreateCompany from "./Pages/Admin/CreateCompany";
import ApprovalRules from "./Pages/Admin/ApprovalRules";
import SubmitExpense from "./Pages/User/SubmitExpense";
import ApprovalDashboard from "./Pages/MiddlePerson/ApprovalDashboard";
import ProfilePage from "./Pages/ProfilePage";
import { AuthProvider } from "./context/AuthContext";

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar
            theme="dark"
            toastClassName="!bg-card !text-card-foreground !border !border-border/60 !shadow-glow-sm"
          />
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              {/* /register is removed — admin creates all accounts via the invite flow */}
              <Route path="/register" element={<Navigate to="/login" replace />} />
              <Route
                path="/admin/dashboard"
                element={<Navigate to="/admin/users" replace />}
              />
              <Route
                path="/manager/dashboard"
                element={<Navigate to="/manager/approvals" replace />}
              />
              <Route
                path="/admin/users"
                element={
                  <RequireRole roles={["admin"]}>
                    <Adduser />
                  </RequireRole>
                }
              />
              <Route
                path="/admin/company/new"
                element={
                  <RequireRole roles={["admin"]}>
                    <CreateCompany />
                  </RequireRole>
                }
              />
              <Route
                path="/admin/approval-rules"
                element={
                  <RequireRole roles={["admin"]}>
                    <ApprovalRules />
                  </RequireRole>
                }
              />
              <Route
                path="/manager/approvals"
                element={
                  <RequireRole roles={["manager"]}>
                    <ApprovalDashboard />
                  </RequireRole>
                }
              />
              <Route
                path="/user/dashboard"
                element={<Navigate to="/user/expenses" replace />}
              />
              <Route
                path="/user/expenses"
                element={
                  <RequireRole roles={["employee"]}>
                    <SubmitExpense />
                  </RequireRole>
                }
              />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <ProfilePage />
                  </RequireAuth>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;
