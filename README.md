# minimax-cli

Use Claude Code CLI with MiniMax M2.7 API — a simple wrapper that handles API key management and settings.

## Prerequisites

- Node.js >= 18
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)

## Installation

```bash
npm install -g minimax-cli
```

## First Run

On first run, the CLI will prompt you for your MiniMax API key:

```bash
minimax-cli
```

Enter your API key when prompted. The key will be saved to `~/.minimax-cli/config.json`.

## Usage

```bash
# Basic usage
minimax-cli "write a hello world program"

# Specify a different MiniMax model
minimax-cli --model MiniMax-M2.7 "your prompt here"

# Pass through any Claude Code CLI arguments
minimax-cli --no-input "your prompt"
```

## Options

| Flag | Description |
|------|-------------|
| `--model <name>` | Override the default model (default: `MiniMax-M2.7-HighSpeed`) |
| `--skip-config` | Skip loading config (for debugging) |

## How It Works

1. Loads your API key from `~/.minimax-cli/config.json`
2. Creates a temporary settings file with the API key
3. Spawns Claude Code CLI with `--settings` pointing to the temp file
4. Cleans up the temp file after Claude Code exits

## Uninstallation

```bash
npm uninstall -g minimax-cli
rm -rf ~/.minimax-cli
```

## License

MIT
