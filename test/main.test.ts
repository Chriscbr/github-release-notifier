import * as cp from 'child_process';
import * as path from 'path';
import * as process from 'process';

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  process.env.INPUT_MODE = 'continuous';
  process.env['INPUT_MAXIMUM-COMMENTS'] = '50';
  process.env.GITHUB_REPOSITORY = 'Chriscbr/release-reminders';
  process.env.GITHUB_WORKSPACE = __dirname;
  process.env.INPUT_TOKEN = process.env.GITHUB_TOKEN;
  const node = process.execPath;
  const main = path.join(__dirname, '..', 'lib', 'main.js');
  const options: cp.ExecFileSyncOptions = {
    env: process.env,
  };
  console.log(cp.execFileSync(node, [main], options).toString());
});