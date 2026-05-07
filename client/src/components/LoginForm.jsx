import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { AuthContext } from "../context/AuthContext";
import { login as loginApi, forgotPassword } from "../services/authService";
import { getHomePathForRole } from "../lib/dashboard-nav";
import { toast } from "react-toastify";
import {
  Card,
  CardTitle,
  CardDescription,
  CardContent,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Form } from "../components/ui/form";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginForm() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const parse = loginSchema.safeParse(form);
    if (!parse.success) {
      const zErrors = parse.error.flatten().fieldErrors;
      setErrors(zErrors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await loginApi(form);
      login(response.token, response.user);
      localStorage.setItem("rms_role", response.user.role);
      toast.success("Login successful!");
      navigate(
        getHomePathForRole(response.user.role, response.user.roles),
      );
    } catch (ex) {
      toast.error(ex.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = form.email.trim();
    if (!email) {
      toast.error("Enter your email above first.");
      return;
    }
    setForgotLoading(true);
    try {
      const msg = await forgotPassword(email);
      toast.success(msg || "Check your email for a new temporary password.");
    } catch (ex) {
      toast.error(ex.message || "Could not send reset email.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-white/10 bg-neutral-950/80 shadow-glow-cyan-soft backdrop-blur-xl transition-all duration-200 hover:border-cyan-500/25 hover:shadow-glow-cyan">
        <CardContent className="space-y-4 p-6">
          <CardTitle className="text-xl font-bold tracking-tight text-white">
            Sign in
          </CardTitle>
          <CardDescription className="text-sm text-gray-400">
            Access the reimbursement management system.
          </CardDescription>

          <Form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-gray-300"
              >
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                placeholder="you@example.com"
                aria-invalid={errors.email ? "true" : "false"}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-300"
              >
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={onChange}
                  placeholder="••••••••"
                  className="pr-16"
                  aria-invalid={errors.password ? "true" : "false"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1.5 text-xs text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.password}
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-start gap-2 text-sm">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                className="text-cyan-400 hover:underline disabled:opacity-50"
              >
                {forgotLoading ? "Sending…" : "Forgot password?"}
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
