import type { IJwtToken } from "../types/token";

export interface ISignUpDto {
  username: string;
  email: string;
  password: string;
}

export interface ILoginDto {
  username: string;
  password: string;
}

export type ILoginResponse = IJwtToken;
