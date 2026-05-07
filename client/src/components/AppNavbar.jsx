import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getHomePathForRole,
  getSidebarItemsForRole,
} from "../lib/dashboard-nav";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

const linkClass =
  "text-gray-400 transition-all duration-200 hover:text-white hover:shadow-[0_0_12px_rgba(34,211,238,0.35)]";

export default function AppNavbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = user?.role;
  const roleNavItems = user
    ? getSidebarItemsForRole(role, user?.roles)
    : [];

  const handleLogout = () => {
    logout();
    localStorage.removeItem("rms_role");
    navigate("/");
    setMobileOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);

  /* ─── Shared nav links (rendered both inline and mobile) ─── */
  const navLinks = (
    <>
      {!isAuthenticated && (
        <>
          <Button variant="ghost" size="sm" className={linkClass} asChild onClick={closeMobile}>
            <Link to="/">Home</Link>
          </Button>
          <Button variant="ghost" size="sm" className={linkClass} asChild onClick={closeMobile}>
            <Link to="/login">Login</Link>
          </Button>
        </>
      )}

      {isAuthenticated && (
        <>
          {roleNavItems.map(({ to, label }) => (
            <Button
              key={to}
              variant="ghost"
              size="sm"
              className={linkClass}
              asChild
              onClick={closeMobile}
            >
              <Link to={to}>{label}</Link>
            </Button>
          ))}
          <Button variant="ghost" size="sm" className={linkClass} asChild onClick={closeMobile}>
            <Link to="/profile">Profile</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-gray-300 transition-all duration-200 hover:border-cyan-500/40 hover:text-cyan-300"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 shadow-glow-inset backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
        <Link
          to={
            isAuthenticated
              ? getHomePathForRole(role, user?.roles)
              : "/"
          }
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-white transition-transform duration-200 hover:scale-[1.02]"
        >
          <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-sm text-cyan-400 shadow-glow-cyan-soft">
            ReimburseIt
          </span>
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <nav className="hidden items-center gap-1 sm:gap-2 md:flex">
          {navLinks}
        </nav>

        {/* Hamburger toggle — visible only on mobile */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile dropdown panel */}
      <div
        className={cn(
          "overflow-hidden border-t border-white/10 bg-black/90 backdrop-blur-xl transition-all duration-300 ease-in-out md:hidden",
          mobileOpen ? "max-h-[400px] py-3" : "max-h-0 py-0 border-t-0"
        )}
      >
        <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4">
          {navLinks}
        </nav>
      </div>
    </header>
  );
}
