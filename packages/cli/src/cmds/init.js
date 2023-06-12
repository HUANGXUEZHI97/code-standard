const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

const {
  CONFIGURE_NAME,
  print,
  Pkg,
  isGitRepo,
  install,
  COMMAND_NAME,
  execNpmScript
} = require('../utils')
const installGerritCommitMsgHook = require('./install-gerrit-commit-msg');

/**
 * @typedef {import('../utils').Dep} Dep
 * @typedef {Pkg} pkg
 * @typedef {(dep: Dep) => void} addDep
 * @typedef {'react' | 'vue' | 'taro' | 'standard'} ProjectType
 * @typedef {{
 *   typescript: boolean
 *   type: ProjectType
 *   moduleType?: 'es6' | 'commonJS'
 *   environment: 'browser' | 'node'
 *   loose?: boolean
 *   gerritSupport: boolean
 *   gerritHost: string
 * }} Config
 * @typedef {{
 *   pkg: pkg,
 *   addDep: addDep,
 *   onFinish: (cb: () => void) => void
 *   eslintCfgPath: string
 *   cwd: string
 *   config: Config
 * }} Context
 */


/**
 * @param {Context} ctx
 */
function pre(ctx) {
  if (!isGitRepo(ctx.cwd)) {
    print('Error', '请在Git项目内使用该命令');
    process.exit(1);
  }
}

/**
 * @param {Context} ctx
 */
async function husky(ctx) {
  print('Info', '正在初始化 husky');

  const { config, pkg, addDep, onFinish, cwd } = ctx;
  const COMMAND = `${COMMAND_NAME} local-check`;

  //移除旧的 husky配置，增加script命令
  pkg.unset('husky');
  pkg.setScript('local-check', COMMAND);
  pkg.setScript('prepare', 'husky install');

  // 安装或更新 husky
  addDep({ name: 'husky', dev: true });

  const huskyHooksDir = path.join(cwd, '.husky');
  const preCommitFiles = path.join(huskyHooksDir, 'pre-commit');
  if (!huskyHooksDir) {
    await fs.promises.mkdir(huskyHooksDir, { recursive: true });
  }

  // pre-commit hooks
  await fs.promises.writeFile(
    preCommitFiles,
    `#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run local-check`
  );

  await fs.promises.chmod(preCommitFiles, '755');

  // Gerrit COMMIT MSG 命令
  if (config.gerritSupport) {
    await installGerritCommitMsgHook(config.gerritHost);
  }

  // 移除旧的 gerrit 安装命令
  const postinstall = pkg.get('scripts.postinstall');
  if (postinstall && postinstall.includes(COMMAND_NAME)) {
    pkg.unset('scripts.postinstall');
  }

  onFinish(async () => {
    try {
      await execNpmScript('husky install');
      const preCommitFiles = (await fs.promises.readFile(path.join(cwd, '.git/config'))).toString();
      if (!(await preCommitFiles).includes('.husky')) {
        print('Error', '请手动执行 `npx husky install`');
      }
    } catch (error) {
      print('Error', '请手动执行 `npx husky install`', error.message);
    }
  })
}

/**
 * @param {Context} ctx
 */
function eslint(ctx) {
  print('Info', '正在初始化 eslint');
  const { pkg, cwd, config, addDep } = ctx;
}

/**
 * @param {Context} ctx
 */
function prettier(ctx) {

}

/**
 * @param {Context} ctx
 */
function configuration(ctx) {

}

/**
 * 获取参数
 * @param {pkg} pkg 
 * @param {string} cwd 
 * @return {Promise<Config>}
 */
async function getOptions(pkg, cwd) {
  const hasTsConfig = fs.existsSync(path.join(cwd || process.cwd(), 'tsconfig.json'));
  const defaultType = pkg.hasInstall('@tarojs/taro')
    ? 'taro'
    : pkg.hasInstall('vue')
      ? 'vue'
      : pkg.hasInstall('react')
        ? 'react'
        : 'standard';

  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'typescript',
      message: '是否启用 Typescript 检查',
      default: hasTsConfig
    },
    {
      type: 'rawlist',
      name: 'type',
      message: '选择项目类型',
      choices: [
        { name: 'React', value: 'react' },
        { name: 'Vue', value: 'vue' },
        { name: 'Taro', value: 'taro' },
        { name: 'Standard(纯JavaScript)', value: 'standard' }
      ],
      default: defaultType
    },
    {
      type: 'confirm',
      name: 'loose',
      message: '开启宽松模式(老项目过渡阶段建议开启)',
      default: true,
    },
    {
      type: 'rawlist',
      name: 'moduleType',
      message: '选择模块类型',
      choices: [
        {
          name: 'JavaScript modules (import/export)',
          value: 'es6',
        },
        {
          name: 'CommonJS (require/exports)',
          value: 'commonJS',
        },
        {
          name: 'None of these',
          value: '',
        },
      ],
      default: 'es6',
    },
    {
      type: 'rawlist',
      name: 'environment',
      message: '选择运行的环境',
      choices: [
        {
          name: 'Browser',
          value: 'browser',
        },
        {
          name: 'Node',
          value: 'node',
        },
      ],
      default: 'browser',
    },
    {
      type: 'confirm',
      name: 'gerritSupport',
      message: '是否支持 Gerrit',
      default: true,
    },
    {
      type: 'input',
      name: 'gerritHost',
      /**
       *
       * @param {Config} ans
       * @returns
       */
      when: ans => {
        return ans.gerritSupport;
      },
      message: '请输入 Gerrit 服务器地址',
      default: 'http://gerrit.wakedata-inc.com',
    },
  ])

  return answers
}

/**
 * @name 项目初始化
 */
async function exec() {
  const cwd = process.cwd();
  const pkgPath = path.join(cwd, './package.json');
  const eslintCfgPath = path.join(cwd, CONFIGURE_NAME);

  if (!fs.existsSync(pkgPath)) {
    print('Error', '未找到 package.json');
    process.exit(1);
  }

  const pkg = new Pkg(pkgPath);
  const thingsNeedToInstall = [];
  const tasks = [pre, husky, eslint, prettier, configuration];
  const postTasks = [];

  // 根据用户提示获得fix的项目类型和规范
  const config = await getOptions(pkg, cwd);

  /** @type {Context} */
  const ctx = {
    pkg,
    addDep: dep => thingsNeedToInstall.push(dep),
    onFinish: t => postTasks.push(t),
    eslintCfgPath,
    cwd,
    config
  }

  // 执行判断是否git项目、...是否安装包、是否有配置文件
  for (const task of tasks) {
    await task(ctx);
  }

  // 更新package.json
  await pkg.write();

  if (thingsNeedToInstall.length) {
    print('Info', '正在安装依赖，这可能需要一点时间');
    print('Info', `待安装依赖：${thingsNeedToInstall.map(i => i.name).join(', ')}`);
    await install(thingsNeedToInstall);
  }

  // 触发安装依赖后钩子
  for (const task of postTasks) {
    try {
      await task();
    } catch (error) {
      print('Warn', error);
    }
  }
}

module.exports = exec;