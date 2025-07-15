import type { ICreateCatDto, IUpdateCatOwnerDto } from "../dtos/cat";
import type { ICat } from "../types/cat";
import http from "./http";

export const GetCats = async () => {
  const res = await http.get<ICat[]>("/cats");

  return res.data;
};

export const GetCat = async (id: string) => {
  const res = await http.get<ICat>(`/cats/${id}`);

  return res.data;
};

export const CreateCat = async (data: ICreateCatDto) => {
  const res = await http.post<ICat>("/cats", data);

  return res.data;
};

export const UpdateCatOwner = async (id: string, data: IUpdateCatOwnerDto) => {
  const res = await http.patch<ICat>(`/cats/owner/${id}`, data);

  return res.data;
};

export const DeleteCat = async (id: string) => {
  await http.delete(`/cats/${id}`);
};
