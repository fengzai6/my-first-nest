import { Loading } from "@/components/loading";
import { useProfileContext } from "@/components/root/profile-context";
import { SpecialRoles, type SpecialRoles as SpecialRole } from "@/services/types/user";
import { useUserStore } from "@/stores/user";
import { Navigate, Outlet } from "react-router";

interface ISpecialRoleGuardProps {
  roles: SpecialRole[];
}

export const hasAnySpecialRole = (
  userRoles: SpecialRole[] | undefined,
  requiredRoles: SpecialRole[],
) => requiredRoles.some((role) => userRoles?.includes(role));

export const SpecialRoleGuard = ({ roles }: ISpecialRoleGuardProps) => {
  const user = useUserStore((state) => state.user);
  const { isLoading } = useProfileContext();

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (!hasAnySpecialRole(user.specialRoles, roles)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export const LOG_ROUTE_ROLES = [SpecialRoles.Developer, SpecialRoles.SuperAdmin];
