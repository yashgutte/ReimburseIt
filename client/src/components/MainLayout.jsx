import { Outlet } from "react-router-dom";
import AppNavbar from "./AppNavbar";

export default function MainLayout() {
  return (
    <div className="relative min-h-screen bg-black text-gray-100 antialiased">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-18%,rgba(34,211,238,0.14),transparent_55%)]"
        aria-hidden
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(34,211,238,0.06),transparent_45%)]" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <AppNavbar />
        <Outlet />
      </div>
    </div>
  );
}
