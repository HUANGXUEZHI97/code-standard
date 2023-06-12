/**
 * Gerrit commit-msg 安装
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { IS_CI, print } = require('../utils');

const GIT_COMMIT_MSG = '.git/hooks/commit-msg';

/**
 * @param {string} url
 */
async function exec(url) {
  if (IS_CI) {
    // 跳过 CI 环境
    return;
  }

  const huskyHooksDir = '.husky';
  const isNewHusky = fs.existsSync(huskyHooksDir);
  const downloadUrl = url + '/tools/hooks/commit-msg';

  if (isNewHusky) {
    // 新的 husky hooks 放在项目根目录下
    const COMMIT_MSG = path.join(huskyHooksDir, 'commit-msg');
    print('Info', '正在安装 gerrit commit-msg hooks: ' + downloadUrl);

    const req = http.request(downloadUrl, res => {
      const target = fs.createWriteStream(COMMIT_MSG);
      res.pipe(target);

      target.on('close', () => {
        fs.chmodSync(COMMIT_MSG, '755');

        print('Success', 'gerrit commit-msg 安装成功');
      });
    });

    req.end();
  } else {
    if (!fs.existsSync('.git/hooks')) {
      fs.mkdirSync('.git/hooks');
    }

    print('Info', '正在安装 gerrit commit-msg hooks: ' + downloadUrl);

    const req = http.request(downloadUrl, res => {
      const target = fs.createWriteStream(GIT_COMMIT_MSG);
      res.pipe(target);

      target.on('close', () => {
        fs.chmodSync(GIT_COMMIT_MSG, '755');

        if (fs.existsSync('node_modules/husky')) {
          print('Info', 'gerrit commit-msg 兼容 husky');
          fs.writeFileSync(GIT_COMMIT_MSG, `\n\n . "$(dirname "$0")/husky.sh"\n`, { flag: 'a' });
        }

        print('Success', 'gerrit commit-msg 安装成功');
      });
    });

    req.end();
  }
}

module.exports = exec;
