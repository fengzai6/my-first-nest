import { useUserStore } from "@/stores/user";
import axios from "axios";
import type { ILoginResponse } from "../dtos/auth";

const http = axios.create({
  baseURL: "/api",
  timeout: 1000 * 10,
});

/**
 * 刷新 token: 我很特殊，为了防止循环依赖，所以不使用封装，直接使用 axios
 */
export const RefreshToken = async () => {
  const setJwtToken = useUserStore.getState().setJwtToken;

  const res = await http.post<ILoginResponse>("/auth/refresh-token");

  setJwtToken(res.data);

  return res.data;
};
