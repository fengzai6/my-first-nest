import { RefreshToken } from "@/services/api/refresh-token";
import type { IJwtToken } from "@/services/types/token";
import type { IUser } from "@/services/types/user";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface IUserStore {
  user: IUser;
  jwtToken: IJwtToken | null;
  setUser: (user: IUser) => void;
  getAccessToken: () => Promise<string>;
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
    (set, get) => ({
      user: defaultUser,
      jwtToken: null,
      setUser: (user) => set({ user }),
      getAccessToken: async () => {
        let jwtToken = get().jwtToken;

        if (!jwtToken) {
          return "";
        }

        // 如果 jwtToken 过期，则刷新 token
        if (jwtToken.expiresAt && jwtToken.expiresAt < new Date()) {
          try {
            const res = await RefreshToken();

            jwtToken = res;

            set({ jwtToken });

            return jwtToken.accessToken;
          } catch {
            get().logout();
          }
        }

        return jwtToken.accessToken;
      },
      setJwtToken: (jwtToken) => {
        set({ jwtToken });
      },
      logout: () => set({ user: defaultUser, jwtToken: null }),
    }),
    { name: "USER_STORE", storage: createJSONStorage(() => localStorage) },
  ),
);
