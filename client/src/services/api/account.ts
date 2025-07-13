import type { IUser } from "../types/user";
import http from "./http";

export const getAccountProfile = async () => {
  const res = await http.get<IUser>("/account/profile");

  return res.data;
};
