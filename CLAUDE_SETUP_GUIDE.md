# Claude Desktop MCP Server Setup and Usage Guide

This guide will help you set up and use the HR Airdrop MCP server with Claude Desktop.

## Installation

The HR Airdrop MCP server has already been installed to your Claude Desktop application. If you need to reinstall it, you can run:

```bash
pnpm install-mcp
```

## Required API Keys

Before using the HR Airdrop MCP server, you'll need to obtain the following API keys:

1. **Crossmint API Key**: Required for creating and managing custodial wallets.
   - Sign up at [https://www.crossmint.com/](https://www.crossmint.com/)
   - Create a new project and get your API key from the developer dashboard

2. **Resend API Key**: Required for sending notification emails to employees.
   - Sign up at [https://resend.com/](https://resend.com/)
   - Create a new API key from your dashboard
   - Verify your domain for sending emails

3. **Helius API Key** (Optional): For compressed transactions and better RPC performance.
   - Sign up at [https://www.helius.dev/](https://www.helius.dev/)
   - Create a new API key from your dashboard

When you start using the HR Airdrop MCP server, Claude will ask you to provide these API keys as needed.

## Production Mode

The HR Airdrop MCP server now operates in production mode, which means:

1. **Real Blockchain Connections**: The server will attempt to connect to the Solana blockchain and perform real operations when possible.

2. **Real Wallet Creation**: When creating custodial wallets with Crossmint, the server will attempt to create actual wallets using the Crossmint API.

3. **Real Email Sending**: When sending emails, the server will attempt to send actual emails using the Resend API.

4. **Fallback to Simulation**: If any real operation fails (e.g., due to API limits or connectivity issues), the server will automatically fall back to simulation mode for that specific operation.

5. **Detailed Logging**: All operations are logged with detailed information, including whether they're running in production or simulation mode.

## Getting Started

### Step 1: Restart Claude Desktop

After installing the MCP server, you need to restart Claude Desktop to load the server. Close and reopen the application.

### Step 2: Verify MCP Server Connection

When you open Claude Desktop, you should see the HR Airdrop MCP server listed in the "Connected MCP Servers" section of the system prompt. If you don't see it, check the installation and restart Claude Desktop again.

### Step 3: Start Using the MCP Tools

You can now use the HR Airdrop MCP tools directly in your conversation with Claude. Here are some example prompts to get started:

#### Example 1: Connect a Wallet

```
Use the HR Airdrop MCP server to connect a wallet using this private key: [your private key]
```

Claude will use the `connect_wallet` tool to connect your wallet and show you the wallet's public key and SOL balance.

#### Example 2: Create a Token

```
Use the HR Airdrop MCP server to create a new token with the following details:
- Name: Company Rewards
- Symbol: CRW
- Supply: 1000000
```

Claude will use the `create_token` tool to create a new token and show you the mint address.

#### Example 3: Generate Wallets for Employees

```
Use the HR Airdrop MCP server to generate wallets for these employees:
- john@company.com
- sarah@company.com
- mike@company.com
```

Claude will use the `generate_wallets` tool to create custodial wallets for the employees.

#### Example 4: Upload CSV Data

```
Use the HR Airdrop MCP server to upload employee data from sample-employees.csv
```

Claude will use the `upload_csv` tool to process the employee data.

#### Example 5: Calculate Token Amounts

```
Use the HR Airdrop MCP server to calculate token amounts with these role allocations:
- operational: 100
- developer: 200
- manager: 300
- VP: 400
- VIP: 500
```

Claude will use the `calculate_amounts` tool to assign token amounts to each employee based on their role.

#### Example 6: Start Airdrop

```
Use the HR Airdrop MCP server to start the airdrop
```

Claude will use the `start_airdrop` tool to distribute tokens to employee wallets.

#### Example 7: Send Emails

```
Use the HR Airdrop MCP server to send emails to employees with the following details:
- From Email: hr@company.com
- Subject: Your Token Rewards
```

Claude will use the `send_emails` tool to notify employees about their tokens.

#### Example 8: Check Current State

```
Use the HR Airdrop MCP server to get the current state
```

Claude will use the `get_state` tool to show you the current state of the airdrop process.

## Complete Workflow Example

Here's a complete workflow example that you can follow to test all features:

1. Connect a wallet:
   ```
   Use the HR Airdrop MCP server to connect a wallet using this private key: [your private key]
   ```

2. Create a token:
   ```
   Use the HR Airdrop MCP server to create a token named "Company Rewards" with symbol "CRW" and supply 1000000
   ```

3. Add liquidity:
   ```
   Use the HR Airdrop MCP server to add liquidity with 500000 tokens and 1 SOL
   ```

4. Generate wallets:
   ```
   Use the HR Airdrop MCP server to generate wallets for these employees:
   - john@company.com
   - sarah@company.com
   - mike@company.com
   ```

5. Upload CSV data:
   ```
   Use the HR Airdrop MCP server to upload employee data from sample-employees.csv
   ```

6. Calculate token amounts:
   ```
   Use the HR Airdrop MCP server to calculate token amounts with these role allocations:
   - operational: 100
   - developer: 200
   - manager: 300
   - VP: 400
   - VIP: 500
   ```

7. Calculate fees:
   ```
   Use the HR Airdrop MCP server to calculate gas fees
   ```

8. Start airdrop:
   ```
   Use the HR Airdrop MCP server to start the airdrop
   ```

9. Send emails:
   ```
   Use the HR Airdrop MCP server to send emails from hr@company.com
   ```

10. Check state:
    ```
    Use the HR Airdrop MCP server to get the current state
    ```

## Troubleshooting

If you encounter any issues:

1. Make sure Claude Desktop is restarted after installing the MCP server
2. Check that the server is listed in the "Connected MCP Servers" section
3. Verify that the server path in the Claude Desktop config file is correct
4. Check the console output in Claude Desktop for any error messages

## Additional Resources

- [Crossmint Documentation](https://docs.crossmint.com/)
- [Solana Documentation](https://docs.solana.com/)
- [MCP Protocol Documentation](https://github.com/modelcontextprotocol/protocol)
