import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const useUserStore = create()(
  persist(
    (set) => ({
      user: null,
      setUser: (user: any) => set({ user }),
    }),
    { name: "USER_STORE", storage: createJSONStorage(() => localStorage) },
  ),
);
