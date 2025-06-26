import { initSnowflake, resetSnowflake } from '@/shared/utils/snowflake';
import { DataSource } from 'typeorm';
import AppDataSource from './data-source';
import seed from './seeds';

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
