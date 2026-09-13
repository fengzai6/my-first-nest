import { GetProfile } from "@/services/api/account";
import { useUserStore } from "@/stores/user";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { toast } from "sonner";
import { AppSidebar } from "../app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../ui/sidebar";
import { ProfileContext } from "./profile-context";

export const Root = () => {
  const setUser = useUserStore((state) => state.setUser);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  const mutation = useMutation({
    mutationFn: GetProfile,
    onSuccess: (data) => {
      setUser(data);
      setIsProfileLoading(false);
    },
    onError: (error) => {
      setIsProfileLoading(false);
      toast.error(error.message);
    },
  });

  useEffect(() => {
    mutation.mutate();
  }, []);

  return (
    <ProfileContext.Provider value={{ isLoading: isProfileLoading }}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="h-svh overflow-hidden">
          <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-2 px-4 shadow-sm backdrop-blur-sm">
            <SidebarTrigger />
            <div className="flex items-center space-x-2"></div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProfileContext.Provider>
  );
};
