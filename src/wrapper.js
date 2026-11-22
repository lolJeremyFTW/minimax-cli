#!/usr/bin/env node
// minimax-cli: Claude Code met MiniMax als model, via MiniMax' Anthropic-compatibele API.
// Zelfde aanpak als de MiniMax-workers van Orvia (apps/daemon/src/adapters/minimax.ts): geen settings-bestand met de
// sleutel, maar omgevingsvariabelen voor alleen dit proces. De sleutel staat in ~/.minimax-cli/config.json (alleen
// voor jou leesbaar); het platform (internationaal of China) en het model worden bij de eerste keer uitgeprobeerd.

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const CONFIG_DIR = path.join(os.homedir(), '.minimax-cli');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const PLATFORMS = ['https://api.minimax.io/anthropic', 'https://api.minimaxi.com/anthropic'];
const DEFAULT_MODEL = 'MiniMax-M3';

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return null; }
}

function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/** Model-ids om te proberen ("Minimax-M3" spelt de API als "MiniMax-M3"). */
function candidates(model) {
  const typed = model && model.trim();
  const canonical = typed && typed.replace(/^minimax/i, 'MiniMax').replace(/-m(\d)/i, '-M$1');
  return [...new Set([typed, canonical, DEFAULT_MODEL].filter(Boolean))];
}

/** Zoekt het platform dat deze sleutel aanneemt en een model dat het kent, met één klein verzoek per poging. */
async function checkMiniMax(key, model) {
  let last = 'geen antwoord';
  for (const baseUrl of PLATFORMS) {
    for (const m of candidates(model)) {
      let res;
      try {
        res = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': key, authorization: `Bearer ${key}`, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: m, max_tokens: 16, messages: [{ role: 'user', content: 'Say OK.' }] }),
          signal: AbortSignal.timeout(30000),
        });
      } catch (err) {
        last = `${baseUrl}: ${err.message}`;
        break;
      }
      if (res.ok) return { ok: true, baseUrl, model: m };
      last = `${new URL(baseUrl).host} gaf ${res.status}`;
      if (res.status === 401 || res.status === 403) break;
    }
  }
  return { ok: false, probleem: `MiniMax nam de sleutel niet aan (${last})` };
}

function vraag(tekst) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(tekst, antwoord => { rl.close(); resolve(antwoord.trim()); }));
}

async function setup(model) {
  console.log('Eerste keer: plak je MiniMax API-sleutel (van platform.minimax.io). Hij wordt alleen op deze pc bewaard.');
  const key = await vraag('MiniMax API-sleutel: ');
  if (!key) { console.error('Geen sleutel ingevuld.'); process.exit(1); }
  process.stdout.write('Sleutel controleren… ');
  const check = await checkMiniMax(key, model);
  if (!check.ok) { console.error(`\n${check.probleem}`); process.exit(1); }
  saveConfig({ apiKey: key, baseUrl: check.baseUrl, model: check.model });
  console.log(`goed: ${new URL(check.baseUrl).host}, model ${check.model}.`);
  return loadConfig();
}

/** Claude Code zoeken: eerst op het pad (winget, npm -g, native installer). */
function claudeCommand() {
  const zoek = process.platform === 'win32' ? spawnSync('where', ['claude'], { encoding: 'utf8' }) : spawnSync('which', ['claude'], { encoding: 'utf8' });
  const gevonden = (zoek.stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
  return gevonden || null;
}

/** De omgeving voor Claude Code: MiniMax in plaats van Anthropic, voor alleen dit proces. */
function miniMaxEnv(config, model) {
  const m = model || config.model || DEFAULT_MODEL;
  return {
    ...process.env,
    ANTHROPIC_BASE_URL: config.baseUrl,
    ANTHROPIC_AUTH_TOKEN: config.apiKey,
    ANTHROPIC_API_KEY: '',
    ANTHROPIC_MODEL: m,
    ANTHROPIC_SMALL_FAST_MODEL: m,
    ANTHROPIC_DEFAULT_OPUS_MODEL: m,
    ANTHROPIC_DEFAULT_SONNET_MODEL: m,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: m,
    API_TIMEOUT_MS: '600000',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  };
}

async function main() {
  const args = process.argv.slice(2);
  let model = null, opnieuw = false;
  const door = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && i + 1 < args.length) { model = args[++i]; }
    else if (args[i] === '--opnieuw-instellen' || args[i] === '--reset') { opnieuw = true; }
    else door.push(args[i]);
  }

  let config = opnieuw ? null : loadConfig();
  if (!config || !config.apiKey || !config.baseUrl) config = await setup(model);
  if (opnieuw && door.length === 0) return;

  const claude = claudeCommand();
  if (!claude) {
    console.error('Claude Code staat niet op het pad. Installeer het (bijv. winget install Anthropic.ClaudeCode) en probeer opnieuw.');
    process.exit(1);
  }

  const child = spawn(claude, door, { stdio: 'inherit', env: miniMaxEnv(config, model), shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(claude) });
  child.on('close', code => process.exit(code || 0));
  child.on('error', err => { console.error(`Claude Code starten mislukte: ${err.message}`); process.exit(1); });
}

main().catch(err => { console.error(err.message); process.exit(1); });
