import type { IBase } from "./base";
import type { IUser } from "./user";

export interface ICat extends IBase {
  name: string;
  age: number;
  breed: string;
  owner?: IUser;
}
