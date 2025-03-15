# Crossmint HR Airdrop MCP

A Model Context Protocol (MCP) server to help corporate HR teams airdrop Solana tokens to employees. This project provides an efficient way to distribute tokens to employee wallet addresses, with support for role-based allocation and automated email notifications.

## Features

- **Wallet Management**: Connect a Solana wallet or Crossmint wallet to sign and fund transactions
- **Token Creation**: Create custom tokens on the Solana blockchain
- **Liquidity Management**: Add liquidity to new tokens via Raydium AMM
- **Custodial Wallet Generation**: Create Crossmint custodial wallets for employees
- **CSV Import**: Upload employee data with name, email, and role information
- **Role-Based Allocation**: Distribute tokens based on employee roles
- **Gas Fee Estimation**: Calculate transaction fees before airdrop
- **Compressed Airdrops**: Use ZK light protocol for efficient token distribution
- **Email Notifications**: Send employees instructions to access their tokens

## Prerequisites

- Node.js (v16+)
- pnpm package manager
- Solana wallet with SOL for transaction fees
- Crossmint API key for custodial wallet creation
- Resend API key for sending emails
- Helius API key for compressed transactions (optional)

## Installation

### 1. Clone and Setup

```bash
git clone https://github.com/yourusername/crossmint-hr-airdrop-mcp.git
cd crossmint-hr-airdrop-mcp
./setup.sh
```

The setup script will:
- Install dependencies
- Clone required repositories
- Create a `.env` file template
- Build the project

### 2. Configure Environment Variables

Edit the `.env` file with your API keys and configuration:

```
# Crossmint API Key (required for custodial wallet creation)
CROSSMINT_API_KEY=your_crossmint_api_key

# Crossmint Email (required for wallet operations)
CROSSMINT_EMAIL=your_email@example.com

# Resend API Key (required for sending emails)
RESEND_API_KEY=your_resend_api_key

# Helius API Key (optional, for compressed transactions)
HELIUS_API_KEY=your_helius_api_key

# Solana RPC URL (optional, defaults to mainnet-beta)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

### 3. Install to Claude Desktop

```bash
pnpm install-mcp
```

This will install the MCP server to Claude Desktop. You'll need to restart Claude Desktop to load the new MCP server.

## Usage Guide

Once configured, you can use the HR Airdrop MCP server with Claude Desktop by giving it instructions like:

1. Connect a Solana wallet or Crossmint wallet
2. Create a token for employee rewards
3. Add liquidity to the token
4. Generate custodial wallets for employees 
5. Upload a CSV with employee roles
6. Calculate token distribution
7. Calculate gas fees
8. Perform the airdrop
9. Send notification emails

### Available Tools

- `connect_wallet`: Connect a Solana wallet
- `connect_crossmint_wallet`: Connect a Crossmint wallet
- `check_balance`: Check wallet SOL balance
- `create_token`: Create a new token
- `add_liquidity`: Add liquidity to the token
- `generate_wallets`: Create custodial wallets for employees
- `upload_csv`: Process employee data from CSV
- `calculate_amounts`: Calculate token distribution amounts
- `calculate_fees`: Calculate gas fees for the airdrop
- `start_airdrop`: Perform the token airdrop
- `send_emails`: Send notifications to employees
- `get_state`: Check the current state of the airdrop process

## CSV Format

For role-based token distribution, prepare a CSV file with the following columns:

```
name,email,role
John Doe,john@example.com,developer
Jane Smith,jane@example.com,manager
```

Supported roles: `operational`, `developer`, `manager`, `VP`, `VIP`

## Development

To make changes to the project:

1. Modify the TypeScript files in `src/`
2. Rebuild with `pnpm build`
3. Update your Claude Desktop configuration if needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with the [Model Context Protocol](https://github.com/modelcontextprotocol)
- Uses the [@solana/web3.js](https://github.com/solana-labs/solana-web3.js) library
- Uses the [Crossmint SDK](https://github.com/Crossmint/crossmint-sdk) for wallet management
- Uses the [GOAT SDK](https://github.com/goat-sdk/goat) for Solana wallet integration
