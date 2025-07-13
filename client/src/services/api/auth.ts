import type { ILoginDto, ILoginResponse } from "../dtos/auth";
import http from "./http";

export const Login = async (data: ILoginDto) => {
  const res = await http.post<ILoginResponse>("/auth/login", data);

  return res.data;
};

export const Logout = async () => {
  const res = await http.post("/auth/logout");

  return res.data;
};
