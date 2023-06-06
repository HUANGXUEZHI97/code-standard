const fs = require('fs');
const path = require('path');
const { Chalk } = require('chalk');
const { log, warn, error } = require('console');
const { get, set } = require('lodash');
const pkg = require('../package.json');

const chalk = new Chalk();

/**
 * @typedef {{name: string, version?: string, dev: boolean}} Dep
 * @typedef {{
 *   milestone: string,
 *   milestoneAutoUpdate: boolean
 *   formatPatterns?: string | string[]
 *   scriptPatterns?: string | string[]
 *   stylePatterns?: string | string[]
 *   eslintArgs?: string
 *   stylelintArgs?: string
 *   prettierArgs?: string
 * }} Config
 */

const _DEV_ = process.env.NODE_ENV === 'development';

const CONFIGURE_NAME = '.standard.jsonc';

/**
 * package.json 读写
 */
class Pkg {
  /**
   * @param {string} identifier
   */
  constructor(identifier) {
    this.path = identifier;
    this.obj = require(identifier);
    this.dirty = false;
  }

  /**
   * @param {string} name 
   */
  removeDep(name) {
    if (this.obj.dependencies) {
      delete this.obj.dependencies[name];
      this.dirty = true;
    }

    if (this.obj.devDependencies) {
      delete this.obj.devDependencies[name];
      this.dirty = true;
    }
  }

  /**
   * @param {string} name 
   */
  get(name) {
    return get(this.obj, name);
  }

  /**
   * @param {string} name 
   * @param {any} value 
   */
  set(name, value) {
    set(this.obj, name, value);
    this.dirty = true;
  }

  /**
   * @param {string} name 
   */
  getVersion(name) {
    const devDep = this.obj.devDependencies;
    const dep = this.obj.dependencies;
    if (name && name in dep) {
      return dep[name];
    }
    if (name && name in devDep) {
      return devDep[name];
    }

    return null;
  }

  /**
   * @param {string} name 
   */
  hasInstall(name) {
    return this.getVersion(name) !== null;
  }

  refresh() {
    delete require.cache[require.resolve(this.path)];
    this.obj = require(this.path);
    this.dirty = false;
  }

  async write() {
    if (!this.dirty) {
      return;
    }
    await fs.promises.writeFile(this.path, toPrettierdJSON(this.obj));
  }
}

/**
 * @param {object} obj 
 */
function toPrettierdJSON(obj) {
  return JSON.stringify(obj, undefined, 2)
}

/**
 * 是否为 git 仓库
 * @param {string} [cwd]
 */
function isGitRepo(cwd) {
  return fs.existsSync(path.join(cwd || process.cwd(), '.git'))
}

const printPrefix = {
  Success: '✅ ',
  Error: chalk.red('❌ 错误'),
  Warn: chalk.yellow('⚠️ 警告'),
  Info: 'ℹ️',
  Debug: '💻',
};
/**
 * @param {'Error' | 'Warn' | 'Info' | 'Debug' | 'Success'} level
 * @param {any} args
 */
function print(level, ...args) {
  let fn = null;
  switch (level) {
    case 'Error':
      fn = error;
      break;
    case 'Warn':
      fn = warn;
      break;
    default:
      fn = log;
      break;
  }
  if (!_DEV_ && level === 'Debug') {
    return;
  }

  return fn(printPrefix[level] + ' ', ...args);
}

async function install(deps, options = {}) {

}

export {
  pkg,
  CONFIGURE_NAME,
  print,
  Pkg,
  isGitRepo,
  install
}