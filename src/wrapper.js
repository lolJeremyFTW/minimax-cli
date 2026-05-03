#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CONFIG_PATH = path.join(os.homedir(), '.minimax-cli', 'config.json');
const DEFAULT_MODEL = 'MiniMax-M2.7-HighSpeed';

function getClaudePath() {
  const platform = process.platform;

  if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
  } else if (platform === 'darwin' || platform === 'linux') {
    return path.join(__dirname, '..', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function getClaudeArgs(claudePath, model, additionalArgs) {
  const args = [claudePath];

  if (model !== DEFAULT_MODEL) {
    args.push('--model', model);
  }

  const settingsContent = {
    api_key: loadConfig().apiKey
  };

  const tempDir = os.tmpdir();
  const settingsFile = path.join(tempDir, `minimax-settings-${Date.now()}.json`);

  fs.writeFileSync(settingsFile, JSON.stringify(settingsContent));

  args.push('--settings', settingsFile);

  args.push(...additionalArgs);

  return { args, settingsFile };
}

function main() {
  const myArgs = process.argv.slice(2);

  let model = DEFAULT_MODEL;
  let passthroughArgs = [];
  let skipConfig = false;

  for (let i = 0; i < myArgs.length; i++) {
    if (myArgs[i] === '--model' && i + 1 < myArgs.length) {
      model = myArgs[i + 1];
      i++;
    } else if (myArgs[i] === '--skip-config') {
      skipConfig = true;
    } else {
      passthroughArgs.push(myArgs[i]);
    }
  }

  const config = loadConfig();

  if (!config && !skipConfig) {
    console.log('First run detected. Running setup wizard...');
    const { spawn } = require('child_process');
    const installPath = path.join(__dirname, '..', 'install.js');
    const installProcess = spawn('node', [installPath], {
      stdio: 'inherit',
      shell: true
    });
    installProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\nSetup complete! Run minimax-cli again with your prompt.');
      } else {
        console.error('Setup failed. Please run `minimax-cli --skip-config` to bypass or re-run install.');
        process.exit(1);
      }
    });
    return;
  }

  if (!config) {
    console.error('No config found. Please run `minimax-cli` to set up your API key first.');
    process.exit(1);
  }

  const claudePath = getClaudePath();

  if (!fs.existsSync(claudePath)) {
    console.error(`Claude Code CLI not found at: ${claudePath}`);
    console.error('Please ensure Claude Code CLI is installed: npm install -g @anthropic-ai/claude-code');
    process.exit(1);
  }

  const { args: claudeArgs, settingsFile } = getClaudeArgs(claudePath, model, passthroughArgs);

  const child = spawn('node', claudeArgs, {
    stdio: 'inherit',
    shell: true
  });

  child.on('close', (code) => {
    try {
      fs.unlinkSync(settingsFile);
    } catch {}
    process.exit(code || 0);
  });

  child.on('error', (err) => {
    console.error('Failed to start Claude Code:', err.message);
    process.exit(1);
  });
}

main();
