import { useUserStore } from "@/stores/user";
import { Navigate, Outlet } from "react-router";

export const AuthGuard = () => {
  const jwtToken = useUserStore((state) => state.jwtToken);

  if (!jwtToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
