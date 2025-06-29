/**
 * 是否为生产环境
 */
export const IsProduction = process.env.NODE_ENV === 'production';

/**
 * 是否为开发环境
 */
export const IsDev =
  process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
