import { Root } from "@/components/root";
import { useUserStore } from "@/stores/user";
import { Navigate } from "react-router";

export const AuthGuard = () => {
  const jwtToken = useUserStore((state) => state.jwtToken);

  if (!jwtToken) {
    return <Navigate to="/login" replace />;
  }

  return <Root />;
};
