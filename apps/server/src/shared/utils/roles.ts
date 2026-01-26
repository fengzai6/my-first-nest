/**
 * 检查用户是否具有指定的角色
 * @param roles 需要检查的角色
 * @param userRoles 用户拥有的角色
 * @returns 如果用户具有指定的角色，则返回 true，否则返回 false
 */
export const matchRoles = (roles: string[], userRoles: string[]) => {
  return roles.some((role) => userRoles.includes(role));
};
