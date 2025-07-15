import { Button } from "@/components/ui/button";
import { tryCatch } from "@/lib/utils";
import { GetProfile } from "@/services/api/account";
import { Logout } from "@/services/api/auth";
import { useUserStore } from "@/stores/user";
import { useEffect } from "react";
import { useShallow } from "zustand/shallow";

export const Home = () => {
  const [user, setUser, logout] = useUserStore(
    useShallow((state) => [state.user, state.setUser, state.logout]),
  );

  const handleLogout = async () => {
    const [error] = await tryCatch(Logout());

    if (error) {
      console.error(error);
    } else {
      logout();
    }
  };

  const fetchData = async () => {
    const res = await GetProfile();
    setUser(res);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h1 className="text-2xl font-bold">Home</h1>
      <div className="text-lg">Hello, {user?.username}</div>
      <Button onClick={handleLogout} className="mt-4">
        Logout
      </Button>
    </div>
  );
};
