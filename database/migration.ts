import { execSync } from 'child_process';

const command = `ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js -d database/data-source.ts`;

const run = (command: string) => {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

const runGenerate = () => {
  const migrationName = process.argv[3];

  if (!migrationName) {
    console.log('Please provide a migration name');
    process.exit(1);
  }

  const timestamp = (() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');
    return `${year}${month}${day}${hour}${minute}${second}`;
  })();

  const generateCommand = `${command} -t ${timestamp} migration:generate database/migrations/${migrationName}`;

  run(generateCommand);
};

const runRevert = () => {
  const revertCommand = `${command} migration:revert`;

  run(revertCommand);
};

const manage = () => {
  const action = process.argv[2];

  switch (action) {
    case 'generate':
      runGenerate();
      break;
    case 'revert':
      runRevert();
      break;
    default:
      console.error('Invalid action');
      process.exit(1);
  }
};

manage();
