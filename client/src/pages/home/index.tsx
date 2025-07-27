import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { tryCatch } from "@/lib/utils";
import { GetProfile } from "@/services/api/account";
import { Logout } from "@/services/api/auth";
import { useUserStore } from "@/stores/user";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";

export const Home = () => {
  const [user, setUser, logout] = useUserStore(
    useShallow((state) => [state.user, state.setUser, state.logout]),
  );

  const { mutate } = useMutation({
    mutationFn: GetProfile,
    onSuccess: (data) => {
      setUser(data);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleLogout = async () => {
    const [error] = await tryCatch(Logout());

    if (error) {
      console.error(error);
    } else {
      logout();
    }
  };

  useEffect(() => {
    mutate();
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex-1">
        <h1 className="text-2xl font-bold">Home</h1>
        <div className="text-lg">Hello, {user?.username}</div>
        <Button onClick={handleLogout} className="mt-4">
          Logout
        </Button>
      </div>
    </SidebarProvider>
  );
};
