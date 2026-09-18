import { Loading } from "@/components/loading";
import { useUserPermissionContext } from "@/components/root/user-permission-context";
import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";

export const hasAnyPermission = (
  userPermissions: string[] | undefined,
  requiredPermissions: string[],
) =>
  requiredPermissions.some((permission) =>
    userPermissions?.includes(permission),
  );

interface IPermissionGuardProps {
  permissions: string[];
  children?: ReactNode;
}

export const PermissionGuard = ({
  permissions,
  children,
}: IPermissionGuardProps) => {
  const { permissions: userPermissions, isLoading } =
    useUserPermissionContext();

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (!hasAnyPermission(userPermissions, permissions)) {
    return <Navigate to="/" replace />;
  }

  return children ?? <Outlet />;
};
