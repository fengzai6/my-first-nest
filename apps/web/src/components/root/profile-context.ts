import { createContext, useContext } from "react";

interface IProfileContext {
  isLoading: boolean;
}

export const ProfileContext = createContext<IProfileContext>({
  isLoading: true,
});

export const useProfileContext = () => useContext(ProfileContext);
