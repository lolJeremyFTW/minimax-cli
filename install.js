#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const inquirer = require('inquirer');
const chalk = require('chalk');
const https = require('https');

const CONFIG_DIR = path.join(os.homedir(), '.minimax-cli');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function validateApiKey(apiKey) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      model: 'MiniMax-M2.7-HightSpeed',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }]
    });

    const options = {
      hostname: 'api.minimax.chat',
      port: 443,
      path: '/v1/text/chatcompletion_v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ valid: true });
        } else {
          try {
            const parsed = JSON.parse(responseData);
            resolve({ valid: false, error: parsed.error?.message || `HTTP ${res.statusCode}` });
          } catch {
            resolve({ valid: false, error: `HTTP ${res.statusCode}` });
          }
        }
      });
    });

    req.on('error', (err) => {
      resolve({ valid: false, error: err.message });
    });

    req.write(data);
    req.end();
  });
}

async function saveConfig(apiKey) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const config = {
    apiKey: apiKey,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function main() {
  console.log(chalk.cyan('\n=== MiniMax CLI Setup ===\n'));

  if (fs.existsSync(CONFIG_PATH)) {
    const existing = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    console.log(chalk.yellow('API key already configured.'));
    console.log(`Created: ${existing.createdAt}\n`);

    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Do you want to update the API key?',
        default: false
      }
    ]);

    if (!overwrite) {
      console.log(chalk.green('No changes made. Exiting.'));
      process.exit(0);
    }
  }

  const { apiKey } = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: 'Enter your MiniMax API key:',
      validate: async (input) => {
        if (!input || input.trim().length < 10) {
          return 'Please enter a valid API key';
        }
        return true;
      }
    }
  ]);

  console.log(chalk.cyan('\nValidating API key...'));

  const result = await validateApiKey(apiKey.trim());

  if (!result.valid) {
    console.log(chalk.red(`\nInvalid API key: ${result.error}`));
    console.log(chalk.yellow('Please check your API key and try again.'));
    process.exit(1);
  }

  await saveConfig(apiKey.trim());

  console.log(chalk.green('\n✓ API key saved successfully!\n'));
  console.log(chalk.bold('Next steps:'));
  console.log('  Run `minimax-cli "your prompt here"` to start chatting with Claude using MiniMax.\n');
}

main().catch((err) => {
  console.error(chalk.red('Setup failed:'), err.message);
  process.exit(1);
});
