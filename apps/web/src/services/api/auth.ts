import type { ILoginDto, ILoginResponse, ISignUpDto } from "../dtos/auth";
import type { IUser } from "../types/user";
import http from "./http";

export const SignUp = async (data: ISignUpDto) => {
  const res = await http.post<IUser>("/auth/signup", data);

  return res.data;
};

export const Login = async (data: ILoginDto) => {
  const res = await http.post<ILoginResponse>("/auth/login", data);

  return res.data;
};

export const Logout = async () => {
  const res = await http.post("/auth/logout");

  return res.data;
};
