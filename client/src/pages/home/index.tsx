import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { GetProfile } from "@/services/api/account";
import { useUserStore } from "@/stores/user";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";

export const Home = () => {
  const [user, setUser] = useUserStore(
    useShallow((state) => [state.user, state.setUser]),
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

  useEffect(() => {
    mutate();
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex-1">
        <h1 className="text-2xl font-bold">Home</h1>
        <div className="text-lg">Hello, {user?.username}</div>
      </div>
    </SidebarProvider>
  );
};
