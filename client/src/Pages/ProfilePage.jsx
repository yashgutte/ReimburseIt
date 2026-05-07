import { useEffect, useState } from "react";
import axiosInstance from "../Authorisation/axiosConfig";
import { useAuth } from "../context/AuthContext";
import { getSidebarItemsForRole } from "../lib/dashboard-nav";
import DashboardLayout from "../components/layout/DashboardLayout";
import DashboardSidebar from "../components/layout/DashboardSidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

export default function ProfilePage() {
  const { user: authUser, logout } = useAuth();
  const [user, setUser] = useState(authUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setUser(authUser);

      if (!authUser?.id && !authUser?._id) {
        setLoading(false);
        return;
      }

      try {
        const response = await axiosInstance.get("/api/auth/profile");
        if (response?.data?.user) {
          setUser(response.data.user);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        setUser(authUser);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [authUser?.id, authUser?._id]);

  const profilePictureSrc =
    user?.profilePicture && typeof user.profilePicture === "string"
      ? user.profilePicture.startsWith("http")
        ? user.profilePicture
        : `http://localhost:8080${user.profilePicture}`
      : "https://flowbite.com/docs/images/people/profile-picture-3.jpg";

  const sidebarItems = getSidebarItemsForRole(authUser?.role);

  return (
    <DashboardLayout
      sidebar={<DashboardSidebar items={sidebarItems} />}
    >
      <div className="flex min-h-[calc(100vh-8rem)] flex-col justify-center py-4">
      <Card className="mx-auto w-full max-w-xl border border-white/10 bg-neutral-950/80 shadow-glow-cyan-soft ring-0 backdrop-blur-xl transition-all duration-200 hover:border-cyan-500/30">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <>
              <div className="flex items-start gap-4">
                <img
                  src={profilePictureSrc}
                  alt={user?.name || "Profile"}
                  className="h-16 w-16 rounded-full border border-white/10 object-cover ring-1 ring-cyan-500/20"
                />
                <div className="flex-1 space-y-2">
                  <h2 className="text-2xl font-bold text-white">
                    {user?.name || "User"}
                  </h2>
                  {user?.username && (
                    <p className="text-sm text-gray-500">@{user.username}</p>
                  )}
                  <p className="text-sm text-gray-400">
                    {user?.email || "—"}
                  </p>
                  <Badge
                    variant="outline"
                    className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                  >
                    {user?.role || "guest"}
                  </Badge>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button variant="destructive" onClick={logout}>
                  Logout
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}
