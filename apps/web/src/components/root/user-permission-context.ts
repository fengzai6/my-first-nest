import { createContext, useContext } from "react";

interface IUserPermissionContext {
  permissions: string[];
  isLoading: boolean;
}

export const UserPermissionContext = createContext<IUserPermissionContext>({
  permissions: [],
  isLoading: true,
});

export const useUserPermissionContext = () => useContext(UserPermissionContext);
