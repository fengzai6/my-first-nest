import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 封装 try catch 捕获错误
 * @param fn 需要捕获的函数
 * @returns 错误或结果
 */
export const tryCatch = async <T = any>(
  fn: Promise<T>,
): Promise<[Error] | [null, T]> => {
  try {
    return [null, await fn];
  } catch (e: any) {
    return [e || new Error("unknown error")];
  }
};

/**
 * 获取字符串的首字母缩写的大写
 * @param str
 * @returns
 */
export const initials = (str: string) => {
  if (!str) return "";

  const words = str.trim().split(/\s+/).filter(Boolean);

  return words.map((word) => word.charAt(0).toUpperCase()).join("");
};
