import type { ILoginDto } from "../dtos/auth";
import http from "./http";

export const Login = (data: ILoginDto) => {
  return http.post("/auth/login", data);
};
