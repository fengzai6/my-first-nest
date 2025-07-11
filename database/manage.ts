import { initSnowflake, resetSnowflake } from '@/shared/utils/snowflake';
import { DataSource } from 'typeorm';
import AppDataSource from './data-source';
import seed from './seeds';

/**
 * 运行迁移: 由于非实际业务仓库，所以 migrations 中的文件是非兼容过去迁移的最新版本
 * 如果需要，可以手动生成自己的迁移文件：yarn migration:generate <migration_name>
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

const manage = async () => {
  const command = process.argv[2];

  if (!command) {
    console.error('请提供一个命令: migrate, seed, 或 init');
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
      default:
        console.log(`未知命令: ${command}. 可用命令: migrate, seed, init.`);
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

manage();
