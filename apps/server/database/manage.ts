import { initSnowflake, resetSnowflake } from '@/shared/utils/snowflake';
import { DataSource } from 'typeorm';
import AppDataSource from './data-source';
import seed from './seeds';

/**
 * 迁移文件只保留当前结构所需的版本，不保留被后续版本替代的中间产物。
 * 重置数据库时按迁移链重建结构。
 * 新增结构变更使用：yarn migration:generate <migration_name>
 */
const runMigrations = async (dataSource: DataSource) => {
  console.log('正在运行迁移...');
  await dataSource.runMigrations();
  console.log('迁移完成.');
};

const runSeed = async (dataSource: DataSource) => {
  console.log('正在填充数据...');
  await seed(dataSource);
  console.log('数据填充完成.');
};

const resetDatabase = async (dataSource: DataSource) => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('禁止在生产环境重置数据库');
  }

  console.log('正在清空数据库...');
  await dataSource.dropDatabase();
  console.log('数据库已清空，正在重新运行迁移...');
  await runMigrations(dataSource);
  await runSeed(dataSource);
};

const manage = async () => {
  const command = process.argv[2];

  if (!command) {
    console.error('请提供一个命令: migrate, seed, init, 或 reset');
    process.exit(1);
  }

  let dataSource: DataSource | null = null;
  try {
    // 由于初始用户需要使用雪花算法生成 ID，所以需要初始化雪花算法
    initSnowflake(
      BigInt(process.env.WORKER_ID || 0),
      BigInt(process.env.DATACENTER_ID || 0),
    );

    dataSource = await AppDataSource.initialize();

    console.log('数据库连接已建立.');

    switch (command) {
      case 'migrate':
        await runMigrations(dataSource);
        break;
      case 'seed':
        await runSeed(dataSource);
        break;
      case 'init':
        await runMigrations(dataSource);
        await runSeed(dataSource);
        break;
      case 'reset':
        await resetDatabase(dataSource);
        break;
      default:
        console.log(
          `未知命令: ${command}. 可用命令: migrate, seed, init, reset.`,
        );
        break;
    }
  } catch (error) {
    console.error(`执行命令 "${command}" 时出错:`, error);
    process.exit(1);
  } finally {
    resetSnowflake();

    if (dataSource?.isInitialized) {
      await dataSource.destroy();
      console.log('数据库连接已关闭.');
    }
  }
};

manage().catch(console.error);
