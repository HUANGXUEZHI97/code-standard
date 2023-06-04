const { Command } = require('commander');
const { pkg } = require('./utils');

const progress = new Command();
progress.version(pkg.version);
progress.description(pkg.description);

progress.
  command('init')
  .description('初始化项目格式包')
  .action(() => {
    const init = require('./cmds/init');
    init();
  })