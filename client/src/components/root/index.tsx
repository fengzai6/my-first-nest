import { GetProfile } from "@/services/api/account";
import { useUserStore } from "@/stores/user";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Outlet } from "react-router";
import { toast } from "sonner";
import { AppSidebar } from "../app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../ui/sidebar";

export const Root = () => {
  const setUser = useUserStore((state) => state.setUser);

  const { mutate } = useMutation({
    mutationFn: GetProfile,
    onSuccess: (data) => {
      setUser(data);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    mutate();
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-x-hidden overflow-y-auto">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-2 px-4 shadow-sm backdrop-blur-sm">
          <SidebarTrigger />
          <div className="flex items-center space-x-2"></div>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
};
