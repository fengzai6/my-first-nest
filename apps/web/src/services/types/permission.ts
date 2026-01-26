import type { IBase } from "./base";

export interface IPermission extends IBase {
  name: string;
  code: string;
  description?: string;
}
