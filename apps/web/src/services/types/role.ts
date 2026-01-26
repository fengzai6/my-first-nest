import type { IBase } from "./base";
import type { IPermission } from "./permission";

export interface IRole extends IBase {
  name: string;
  code: string;
  description?: string;
  permissions: IPermission[];
}
