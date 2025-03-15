#!/bin/bash
set -e

echo "🚀 Setting up Crossmint HR Airdrop MCP Server"
echo "============================================="

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Clone Solana Agent Kit
if [ ! -d "solana-agent-kit" ]; then
  echo "🔄 Cloning Solana Agent Kit..."
  git clone https://github.com/sendaifun/solana-agent-kit.git
else
  echo "✅ Solana Agent Kit already exists"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
  echo "📝 Creating .env file..."
  cat > .env << EOL
# Crossmint API Key (required for custodial wallet creation)
# Format: ck_development_XXXXXXXX or sk_development_XXXXXXXX
CROSSMINT_API_KEY=your_crossmint_api_key_here

# Resend API Key (required for sending emails)
# Get your API key from https://resend.com
RESEND_API_KEY=your_resend_api_key_here
RESEND_DOMAIN=your_verified_domain.com

# Solana RPC URLs
# Standard Solana RPC (rate limited to 40 requests per second)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Helius RPC URL for compressed airdrops (rate limited to 500k requests per month and 10 Requests/sec)
# It's recommended to get your own API key or paid plan at helius.dev
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your_helius_api_key_here
EOL
  echo "✅ Created .env file template"
  echo "⚠️ Please edit the .env file with your API keys and configuration"
else
  echo "✅ .env file already exists"
fi

# Build the project
echo "🔨 Building the project..."
pnpm build

echo "✅ Setup complete!"
echo "To install the MCP server to Claude Desktop, run:"
echo "  pnpm install-mcp"
echo ""
echo "To test the server, run:"
echo "  pnpm test:integration"
