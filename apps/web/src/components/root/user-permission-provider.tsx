import { GetUserPermissions } from "@/services/api/account";
import { useQuery } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { UserPermissionContext } from "./user-permission-context";

export const UserPermissionProvider = ({ children }: PropsWithChildren) => {
  const { data = [], isLoading } = useQuery({
    queryKey: ["user-permissions"],
    queryFn: GetUserPermissions,
  });

  return (
    <UserPermissionContext.Provider
      value={{
        permissions: data.map((permission) => permission.code),
        isLoading,
      }}
    >
      {children}
    </UserPermissionContext.Provider>
  );
};
