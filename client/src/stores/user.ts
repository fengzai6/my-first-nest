import type { IJwtToken } from "@/services/types/token";
import type { IUser } from "@/services/types/user";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface IUserStore {
  user: IUser;
  jwtToken: IJwtToken | null;
  setUser: (user: IUser) => void;
  setJwtToken: (jwtToken: IJwtToken) => void;
  logout: () => void;
}

const defaultUser: IUser = {
  id: "",
  username: "",
  email: "",
  isActive: false,
  specialRoles: [],
  roles: [],
  createdAt: "",
  updatedAt: "",
};

export const useUserStore = create<IUserStore>()(
  persist(
    (set) => ({
      user: defaultUser,
      jwtToken: null,
      setUser: (user) => set({ user }),
      setJwtToken: (jwtToken) => {
        set({ jwtToken });
      },
      logout: () => set({ user: defaultUser, jwtToken: null }),
    }),
    { name: "USER_STORE", storage: createJSONStorage(() => localStorage) },
  ),
);
