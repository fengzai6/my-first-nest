import { Login } from "@/services/api/auth";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface IUserStore {
  user: any;
  accessToken: string;
  setUser: (user: any) => void;
  login: (user: any, accessToken: string) => void;
}

export const useUserStore = create<IUserStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: "",
      setUser: (user: any) => set({ user }),
      login: async (user: any, accessToken: string) => {
        const res = await Login({
          username: user.username,
          password: user.password,
        });
        set({ user: res.data.user, accessToken: res.data.accessToken });
      },
    }),
    { name: "USER_STORE", storage: createJSONStorage(() => localStorage) },
  ),
);
