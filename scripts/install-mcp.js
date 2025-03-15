#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Get the absolute path to the server.js file
const serverPath = path.resolve(projectRoot, 'build', 'server.js');

// Claude Desktop config path based on OS
let configPath;
if (os.platform() === 'darwin') {
  // macOS
  configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
} else if (os.platform() === 'win32') {
  // Windows
  configPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
} else {
  // Linux and others
  configPath = path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

// Create config directory if it doesn't exist
const configDir = path.dirname(configPath);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Create or update the config file
let config = { mcpServers: {} };
if (fs.existsSync(configPath)) {
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configContent);
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
  } catch (error) {
    console.error('Error reading existing config:', error);
  }
}

// Add our MCP server to the config
config.mcpServers['hr-airdrop'] = {
  command: 'node',
  args: [serverPath],
  env: {},
  disabled: false,
  autoApprove: []
};

// Write the updated config
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log(`
✅ HR Airdrop MCP server installed successfully!

Configuration:
- Server path: ${serverPath}
- Config file: ${configPath}

Next steps:
1. Restart Claude Desktop to load the MCP server
2. In Claude, you can now use the HR Airdrop tools

For more information, see the CLAUDE_SETUP_GUIDE.md file.
`);
