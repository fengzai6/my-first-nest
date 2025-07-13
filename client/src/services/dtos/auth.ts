import type { IJwtToken } from "../types/token";

export interface ILoginDto {
  username: string;
  password: string;
}

export type ILoginResponse = IJwtToken;
