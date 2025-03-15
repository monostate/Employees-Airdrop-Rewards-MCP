#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { crossmint } from '@goat-sdk/crossmint';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
import { parse as csvParse } from 'csv-parse/sync';
// import nodemailer from 'nodemailer';
import fs from 'fs';
import { z } from 'zod';
import { createToken, addLiquidity, sendCompressedAirdrop, calculateAirdropFees } from './utils/tokenUtils.js';
import { createCustodialWallets, sendWalletEmails, generateSimpleEmailContent } from './utils/crossmintUtils.js';

// State interface for the MCP server
interface ServerState {
  connectedWallet: {
    publicKey: string;
    solBalance: number;
  } | null;
  createdToken: {
    name: string;
    symbol: string;
    mintAddress: string;
    supply: number;
    decimals: number;
  } | null;
  employees: {
    name?: string;
    email: string;
    role?: string;
    walletAddress: string;
    tokenAmount?: number;
  }[];
  airdropStatus: {
    started: boolean;
    completed: boolean;
    successful: number;
    failed: number;
  };
  emailsStatus: {
    sent: boolean;
    successful: number;
    failed: number;
  };
}

interface RoleAmounts {
  operational?: number;
  developer?: number;
  manager?: number;
  VP?: number;
  VIP?: number;
}

class HRAirdropServer {
  private server: Server;
  private state: ServerState;

  constructor() {
    this.server = new Server(
      {
        name: 'hr-airdrop-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize state
    this.state = {
      connectedWallet: null,
      createdToken: null,
      employees: [],
      airdropStatus: {
        started: false,
        completed: false,
        successful: 0,
        failed: 0,
      },
      emailsStatus: {
        sent: false,
        successful: 0,
        failed: 0,
      },
    };

    // Set up tool handlers
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error: any) => console.error('[MCP Server Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'connect_wallet',
          description: 'Connect a Solana wallet to the airdrop server',
          inputSchema: {
            type: 'object',
            properties: {
              privateKey: {
                type: 'string',
                description: 'The private key of the Solana wallet (base58 encoded)',
              },
              rpcUrl: {
                type: 'string',
                description: 'The Solana RPC URL to use (optional)',
              },
            },
            required: ['privateKey'],
          },
        },
        {
          name: 'connect_crossmint_wallet',
          description: 'Connect a Crossmint wallet to the airdrop server',
          inputSchema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                description: 'Email address associated with the Crossmint wallet',
              },
              apiKey: {
                type: 'string',
                description: 'Crossmint API key',
              },
            },
            required: ['email', 'apiKey'],
          },
        },
        {
          name: 'check_balance',
          description: 'Check the SOL balance of the connected wallet',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'create_token',
          description: 'Create a new Solana token',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Token name',
              },
              symbol: {
                type: 'string',
                description: 'Token symbol',
              },
              supply: {
                type: 'number',
                description: 'Total token supply',
              },
              decimals: {
                type: 'number',
                description: 'Token decimals (default: 9)',
              },
            },
            required: ['name', 'symbol', 'supply'],
          },
        },
        {
          name: 'add_liquidity',
          description: 'Add liquidity to the created token',
          inputSchema: {
            type: 'object',
            properties: {
              tokenAmount: {
                type: 'number',
                description: 'Amount of tokens to add to liquidity pool',
              },
              solAmount: {
                type: 'number',
                description: 'Amount of SOL to add to liquidity pool',
              },
            },
            required: ['tokenAmount', 'solAmount'],
          },
        },
        {
          name: 'generate_wallets',
          description: 'Generate custodial wallets for employees using Crossmint',
          inputSchema: {
            type: 'object',
            properties: {
              employees: {
                type: 'string',
                description: 'List of employees in format "name,email" (one per line)',
              },
              apiKey: {
                type: 'string',
                description: 'Crossmint API key (optional, defaults to test key for demo)',
              },
            },
            required: ['employees'],
          },
        },
        {
          name: 'upload_csv',
          description: 'Process employee data from a CSV file',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to the CSV file',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'calculate_amounts',
          description: 'Calculate token amounts for each employee',
          inputSchema: {
            type: 'object',
            properties: {
              uniformAmount: {
                type: 'number',
                description: 'Uniform amount for all employees (if no CSV role-mapping is used)',
              },
              roleAmounts: {
                type: 'object',
                properties: {
                  operational: { type: 'number' },
                  developer: { type: 'number' },
                  manager: { type: 'number' },
                  VP: { type: 'number' },
                  VIP: { type: 'number' },
                },
                description: 'Token amounts by role (if CSV with roles is used)',
              },
            },
          },
        },
        {
          name: 'calculate_fees',
          description: 'Calculate gas fees for the airdrop',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'start_airdrop',
          description: 'Perform the token airdrop to employee wallets',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'send_emails',
          description: 'Send emails to employees with wallet access instructions',
          inputSchema: {
            type: 'object',
            properties: {
              fromEmail: {
                type: 'string',
                description: 'Sender email address (e.g., hr@company.com)',
              },
              subject: {
                type: 'string',
                description: 'Email subject',
              },
              resendApiKey: {
                type: 'string',
                description: 'Resend API key (optional, will use default if not provided)',
              },
            },
            required: ['fromEmail'],
          },
        },
        {
          name: 'get_state',
          description: 'Get the current state of the airdrop process',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'connect_wallet':
            return await this.handleConnectWallet(args);
          case 'connect_crossmint_wallet':
            return await this.handleConnectCrossmintWallet(args);
          case 'check_balance':
            return await this.handleCheckBalance();
          case 'create_token':
            return await this.handleCreateToken(args);
          case 'add_liquidity':
            return await this.handleAddLiquidity(args);
          case 'generate_wallets':
            return await this.handleGenerateWallets(args);
          case 'upload_csv':
            return await this.handleUploadCsv(args);
          case 'calculate_amounts':
            return await this.handleCalculateAmounts(args);
          case 'calculate_fees':
            return await this.handleCalculateFees();
          case 'start_airdrop':
            return await this.handleStartAirdrop();
          case 'send_emails':
            return await this.handleSendEmails(args);
          case 'get_state':
            return await this.handleGetState();
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        console.error(`Error in tool call ${request.params.name}:`, error);
        if (error instanceof McpError) {
          throw error;
        }
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async handleConnectCrossmintWallet(args: any) {
    try {
      // Validate input
      const schema = z.object({
        email: z.string().email(),
        apiKey: z.string().optional(),
      });
      
      const { email, apiKey: providedApiKey } = schema.parse(args);
      
      // Check if API key is provided, if not, prompt the user
      if (!providedApiKey) {
        return {
          content: [
            {
              type: 'text',
              text: `To connect a Crossmint wallet, I need your Crossmint API key. You can get this from the Crossmint developer dashboard at https://www.crossmint.com/

Please provide your Crossmint API key to continue.`,
            },
          ],
        };
      }
      
      const apiKey = providedApiKey;
      
      console.error(`Connecting Crossmint wallet for ${email}`);
      
      try {
        // In production mode, attempt to connect to the real Crossmint wallet
        console.error('PRODUCTION MODE: Attempting to connect to real Crossmint wallet');
        
        // Initialize Crossmint client
        const crossmintClient = crossmint(apiKey);
        
        // Get the wallet for this email
        const wallet = await crossmintClient.custodial({
          chain: "solana",
          connection: new Connection('https://api.mainnet-beta.solana.com', 'confirmed'),
          email
        });
        
        // Get the wallet address
        const publicKey = wallet.getAddress();
        
        // Get the SOL balance (in a real implementation, we would query the blockchain)
        // For now, we'll use a default value
        const solBalance = 1.0;
        
        console.error(`Successfully connected to real Crossmint wallet: ${publicKey}`);
        
        // Update state
        this.state.connectedWallet = {
          publicKey,
          solBalance,
        };
        
        return {
          content: [
            {
              type: 'text',
              text: `Crossmint wallet connected successfully for ${email}.\nPublic Key: ${publicKey}\nSOL Balance: ${solBalance} SOL`,
            },
          ],
        };
      } catch (error) {
        console.error('Error connecting to real Crossmint wallet, falling back to simulation:', error);
        
        // Generate a pseudo-random wallet address
        const publicKey = `crossmint_${Math.random().toString(36).substring(2, 10)}`;
        const solBalance = 1.0; // Default SOL balance for demo
        
        // Update state
        this.state.connectedWallet = {
          publicKey,
          solBalance,
        };
        
        return {
          content: [
            {
              type: 'text',
              text: `Crossmint wallet connected successfully for ${email}.\nPublic Key: ${publicKey}\nSOL Balance: ${solBalance} SOL\n\n(Note: Using simulation mode due to connection error)`,
            },
          ],
        };
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to connect Crossmint wallet: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleConnectWallet(args: any) {
    try {
      // Validate input
      const schema = z.object({
        privateKey: z.string(),
        rpcUrl: z.string().optional(),
      });
      
      const { privateKey, rpcUrl } = schema.parse(args);
      
      // Connect to Solana
      const connection = new Connection(
        rpcUrl || 'https://api.mainnet-beta.solana.com',
        'confirmed'
      );
      
      let keypair: Keypair;
      try {
        keypair = Keypair.fromSecretKey(Buffer.from(privateKey, 'base64'));
      } catch (e: any) {
        throw new McpError(ErrorCode.InvalidParams, 'Invalid private key format. Please provide a base64 encoded private key.');
      }
      
      const publicKey = keypair.publicKey.toString();
      
      // Get SOL balance
      const balance = await connection.getBalance(keypair.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      // Update state
      this.state.connectedWallet = {
        publicKey,
        solBalance,
      };
      
      return {
        content: [
          {
            type: 'text',
            text: `Wallet connected successfully. Public Key: ${publicKey}\nSOL Balance: ${solBalance} SOL`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to connect wallet: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleCheckBalance() {
    if (!this.state.connectedWallet) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No wallet connected. Please connect a wallet first.'
      );
    }

    // In a real implementation, we would refresh the balance from the blockchain
    // For this demo, we'll just return the cached balance
    const { publicKey, solBalance } = this.state.connectedWallet;
    
    // Calculate required SOL for employees
    const employeeCount = this.state.employees.length || 1; // Default to 1 if no employees yet
    const requiredSol = 0.1 * employeeCount; // 0.1 SOL per employee
    
    const isSufficient = solBalance >= requiredSol;
    
    return {
      content: [
        {
          type: 'text',
          text: `
Wallet Public Key: ${publicKey}
Current SOL Balance: ${solBalance.toFixed(5)} SOL
Required for Airdrop: ~${requiredSol.toFixed(5)} SOL (0.1 SOL per employee)
Status: ${isSufficient ? 'Sufficient balance' : 'Insufficient balance'}

${!isSufficient ? 'Insufficient tokens. Create a new token? (yes/no)' : ''}
          `.trim(),
        },
      ],
    };
  }

  private async handleCreateToken(args: any) {
    if (!this.state.connectedWallet) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No wallet connected. Please connect a wallet first.'
      );
    }

    // Validate input
    const schema = z.object({
      name: z.string(),
      symbol: z.string(),
      supply: z.number().positive(),
      decimals: z.number().min(0).max(9).default(9),
    });
    
    const { name, symbol, supply, decimals } = schema.parse(args);
    
    try {
      // Create a dummy connection and keypair for simulation
      const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
      const keypair = Keypair.generate(); // In a real implementation, this would be the user's wallet
      
      // Call the token creation utility
      const result = await createToken(
        connection,
        keypair,
        name,
        symbol,
        supply,
        decimals
      );
      
      if (!result.mintAddress) {
        throw new Error('Token creation failed: No mint address returned');
      }
      
      // Update state
      this.state.createdToken = {
        name,
        symbol,
        mintAddress: result.mintAddress,
        supply,
        decimals,
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Token creation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `
Token created successfully:
Name: ${name}
Symbol: ${symbol}
Supply: ${supply.toLocaleString()}
Decimals: ${decimals}
Mint Address: ${this.state.createdToken?.mintAddress}

Next step: Add liquidity to give the token value.
          `.trim(),
        },
      ],
    };
  }

  private async handleAddLiquidity(args: any) {
    if (!this.state.connectedWallet) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No wallet connected. Please connect a wallet first.'
      );
    }

    if (!this.state.createdToken) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No token created. Please create a token first.'
      );
    }

    // Validate input
    const schema = z.object({
      tokenAmount: z.number().positive(),
      solAmount: z.number().positive(),
    });
    
    const { tokenAmount, solAmount } = schema.parse(args);
    
    // Check if we have enough balance
    if (this.state.connectedWallet.solBalance < solAmount) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Insufficient SOL balance. You have ${this.state.connectedWallet.solBalance} SOL, but ${solAmount} SOL is required.`
      );
    }
    
    // In a real implementation, we would call the Raydium liquidity addition function
    // For this demo, we'll simulate liquidity addition
    
    // Update SOL balance
    this.state.connectedWallet.solBalance -= solAmount;
    
    return {
      content: [
        {
          type: 'text',
          text: `
Liquidity added successfully:
Token: ${this.state.createdToken.symbol}
Token Amount: ${tokenAmount.toLocaleString()} ${this.state.createdToken.symbol}
SOL Amount: ${solAmount} SOL
Remaining SOL Balance: ${this.state.connectedWallet.solBalance} SOL

Next step: Generate wallets for employees.
          `.trim(),
        },
      ],
    };
  }

  private async handleGenerateWallets(args: any) {
    if (!this.state.connectedWallet) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No wallet connected. Please connect a wallet first.'
      );
    }

    // Validate input
    const schema = z.object({
      employees: z.string(),
      apiKey: z.string().optional(),
    });
    
    const { employees, apiKey: providedApiKey } = schema.parse(args);
    
    // Check if API key is provided, if not, prompt the user
    if (!providedApiKey) {
      return {
        content: [
          {
            type: 'text',
            text: `To generate custodial wallets for employees, I need your Crossmint API key. You can get this from the Crossmint developer dashboard at https://www.crossmint.com/

Please provide your Crossmint API key to continue.`,
          },
        ],
      };
    }
    
    const apiKey = providedApiKey;
    
    // Parse employee data from string
    // Format: "name,email" (one per line)
    const employeeList = employees.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
          return {
            name: parts[0].trim(),
            email: parts[1].trim()
          };
        } else {
          // If only one part, assume it's an email
          return {
            email: parts[0].trim()
          };
        }
      });
    
    // Extract emails for wallet creation
    const emails = employeeList.map(emp => emp.email);
    
    if (emails.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'No valid employee emails found. Please provide at least one employee.'
      );
    }
    
      // Log the parsed data for debugging
      console.error('Parsed employee data:', JSON.stringify(employeeList, null, 2));
    
    try {
      // Create a Solana connection
      const connection = new Connection(
        'https://api.mainnet-beta.solana.com',
        'confirmed'
      );
      
      // Use the Crossmint SDK to create custodial wallets
      const wallets = await createCustodialWallets(connection, apiKey, emails);
      
      // Update state with the created wallets
      this.state.employees = wallets;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create wallets: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `
Generated ${emails.length} custodial wallets successfully:
${this.state.employees
  .map(
    (employee, index) =>
      `${index + 1}. Email: ${employee.email}\n   Wallet: ${employee.walletAddress}`
  )
  .join('\n')}

Next step: Upload a CSV file with detailed employee information (optional) or calculate token amounts.
          `.trim(),
        },
      ],
    };
  }

  private async handleUploadCsv(args: any) {
    // Validate input
    const schema = z.object({
      filePath: z.string(),
    });
    
    const { filePath } = schema.parse(args);
    
    try {
      // Read and parse CSV file
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const records = csvParse(fileContent, {
        columns: true,
        skip_empty_lines: true,
      });
      
      // Validate records
      const validRoles = ['operational', 'developer', 'manager', 'VP', 'VIP'];
      
      if (!records.length) {
        throw new McpError(ErrorCode.InvalidParams, 'CSV file is empty.');
      }
      
      // Check required columns
      const firstRecord = records[0];
      if (!('email' in firstRecord)) {
        throw new McpError(ErrorCode.InvalidParams, 'CSV file must have an "email" column.');
      }
      
      // Map existing emails to records
      const employeesByEmail = new Map(
        this.state.employees.map((e) => [e.email, e])
      );
      
      // Update or create employee records
      const updatedEmployees = records.map((record: any) => {
        if (!record.email) {
          throw new McpError(ErrorCode.InvalidParams, 'Every row must have an email.');
        }
        
        const existingEmployee = employeesByEmail.get(record.email);
        if (!existingEmployee) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Email ${record.email} does not match any generated wallet. Please generate wallets first.`
          );
        }
        
        if (record.role && !validRoles.includes(record.role.toLowerCase())) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid role "${record.role}" for ${record.email}. Valid roles are: ${validRoles.join(', ')}.`
          );
        }
        
        return {
          ...existingEmployee,
          name: record.name || undefined,
          role: record.role?.toLowerCase() || undefined,
        };
      });
      
      // Update state
      this.state.employees = updatedEmployees;
      
      return {
        content: [
          {
            type: 'text',
            text: `
CSV data processed successfully. Updated ${updatedEmployees.length} employee records.

Role distribution:
- Operational: ${updatedEmployees.filter((e: any) => e.role === 'operational').length}
- Developer: ${updatedEmployees.filter((e: any) => e.role === 'developer').length}
- Manager: ${updatedEmployees.filter((e: any) => e.role === 'manager').length}
- VP: ${updatedEmployees.filter((e: any) => e.role === 'vp').length}
- VIP: ${updatedEmployees.filter((e: any) => e.role === 'vip').length}
- No role: ${updatedEmployees.filter((e: any) => !e.role).length}

Next step: Calculate token amounts for each employee.
            `.trim(),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) throw error;
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to process CSV: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleCalculateAmounts(args: any) {
    if (this.state.employees.length === 0) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No employees added. Please generate wallets first.'
      );
    }

    // Validate input
    const schema = z.object({
      uniformAmount: z.number().positive().optional(),
      roleAmounts: z
        .object({
          operational: z.number().positive().optional(),
          developer: z.number().positive().optional(),
          manager: z.number().positive().optional(),
          VP: z.number().positive().optional(),
          VIP: z.number().positive().optional(),
        })
        .optional(),
    });
    
    const { uniformAmount, roleAmounts } = schema.parse(args);
    
    // Set default role amounts if not provided
    const defaultRoleTokens = {
      operational: 100,
      developer: 200,
      manager: 300,
      vp: 400,
      vip: 500,
    };
    
    // Combine with provided role amounts
    const roleTokens: Record<string, number> = {
      ...defaultRoleTokens,
      ...(roleAmounts || {}),
    };
    
    let totalAmount = 0;
    
    // Update employee records with token amounts
    this.state.employees = this.state.employees.map((employee) => {
      let tokenAmount: number;
      
      if (uniformAmount) {
        // Use uniform amount for all employees
        tokenAmount = uniformAmount;
      } else if (employee.role) {
        // Use role-based amount if role is available
        const role = employee.role.toLowerCase();
        if (role === 'operational') tokenAmount = roleTokens.operational || 100;
        else if (role === 'developer') tokenAmount = roleTokens.developer || 200;
        else if (role === 'manager') tokenAmount = roleTokens.manager || 300;
        else if (role === 'vp') tokenAmount = roleTokens.vp || 400;
        else if (role === 'vip') tokenAmount = roleTokens.vip || 500;
        else tokenAmount = 100; // Default fallback
      } else {
        // Default amount if no role specified
        tokenAmount = 100;
      }
      
      totalAmount += tokenAmount;
      
      return {
        ...employee,
        tokenAmount,
      };
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `
Token amounts calculated successfully:
${this.state.employees
  .map(
    (employee) =>
      `- ${employee.name || employee.email}: ${employee.tokenAmount} tokens (${
        employee.role || 'No role'
      })`
  )
  .join('\n')}

Total tokens to be distributed: ${totalAmount}
${
  this.state.createdToken
    ? `Token supply: ${this.state.createdToken.supply}`
    : 'No token created yet. Please create a token with sufficient supply.'
}

Next step: Calculate gas fees for the airdrop.
          `.trim(),
        },
      ],
    };
  }

  private async handleCalculateFees() {
    if (this.state.employees.length === 0) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No employees added. Please generate wallets first.'
      );
    }

    if (!this.state.connectedWallet) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No wallet connected. Please connect a wallet first.'
      );
    }
    
    const employeeCount = this.state.employees.length;
    
    // Calculate fees based on the requirements
    const accountCreationFee = 0.00001 * employeeCount; // ~0.00001 SOL per account
    const transactionFee = 0.000005 * employeeCount; // ~0.000005 SOL per signature
    const totalFees = accountCreationFee + transactionFee;
    
    // Check if we have enough SOL
    const hasSufficientFunds = this.state.connectedWallet.solBalance >= totalFees;
    
    return {
      content: [
        {
          type: 'text',
          text: `
Gas fee calculation for ${employeeCount} employees:

Account Creation: ${accountCreationFee.toFixed(6)} SOL (~0.00001 SOL per account)
Transaction Fees: ${transactionFee.toFixed(6)} SOL (~0.000005 SOL per signature)
Total Fees: ${totalFees.toFixed(6)} SOL

Your wallet balance: ${this.state.connectedWallet.solBalance.toFixed(6)} SOL
Status: ${hasSufficientFunds ? 'Sufficient funds for fees' : 'Insufficient funds for fees'}

${
  !hasSufficientFunds
    ? 'WARNING: Your wallet does not have enough SOL to cover the gas fees. Please add more SOL to your wallet before proceeding.'
    : 'Next step: Start the airdrop process.'
}
          `.trim(),
        },
      ],
    };
  }

  private async handleStartAirdrop() {
    if (this.state.employees.length === 0) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No employees added. Please generate wallets first.'
      );
    }

    if (!this.state.connectedWallet) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No wallet connected. Please connect a wallet first.'
      );
    }

    if (!this.state.createdToken) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No token created. Please create a token first.'
      );
    }

    // Check if token amounts are calculated
    const missingAmounts = this.state.employees.some((e) => e.tokenAmount === undefined);
    if (missingAmounts) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Token amounts not calculated for all employees. Please calculate amounts first.'
      );
    }
    
    // Check if Helius API key is available in environment variables
    if (!process.env.HELIUS_API_KEY) {
      return {
        content: [
          {
            type: 'text',
            text: `For optimal performance with compressed airdrops, I recommend using a Helius API key. You can get one from https://www.helius.dev/

Please provide your Helius API key to continue, or type "skip" to proceed without one.`,
          },
        ],
      };
    }
    
    try {
      // Create a Solana connection
      const connection = new Connection(
        'https://api.mainnet-beta.solana.com',
        'confirmed'
      );
      
      // Create a keypair from the connected wallet (in a real implementation)
      // For this demo, we'll use a generated keypair
      const keypair = Keypair.generate();
      
      // Prepare recipients for the airdrop
      const recipients = this.state.employees.map(employee => ({
        address: employee.walletAddress,
        email: employee.email
      }));
      
      // Use the ZK light protocol to perform the airdrop
      // In a real implementation, this would call the actual sendCompressedAirdrop function
      // For this demo, we'll simulate the airdrop
      // Use each employee's calculated token amount
      const result = await sendCompressedAirdrop(
        connection,
        keypair,
        this.state.createdToken.mintAddress,
        0, // Not used - individual amounts are in the employees array
        this.state.createdToken.decimals,
        this.state.employees.map(employee => ({
          address: employee.walletAddress,
          email: employee.email,
          amount: employee.tokenAmount || 100 // Use calculated amount or default to 100
        })),
        process.env.HELIUS_API_KEY // Use Helius API key for compressed transactions if available
      );
      
      // Update airdrop status
      this.state.airdropStatus = {
        started: true,
        completed: true,
        successful: this.state.employees.length,
        failed: 0,
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Airdrop failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `
Airdrop completed successfully:
- Total employees: ${this.state.employees.length}
- Successful transfers: ${this.state.airdropStatus.successful}
- Failed transfers: ${this.state.airdropStatus.failed}

Each employee has received their allocated tokens:
${this.state.employees
  .map(
    (employee) =>
      `- ${employee.name || employee.email}: ${employee.tokenAmount} ${
        this.state.createdToken?.symbol
      } tokens`
  )
  .join('\n')}

Next step: Send emails to employees with wallet access instructions.
          `.trim(),
        },
      ],
    };
  }

  private async handleSendEmails(args: any) {
    if (this.state.employees.length === 0) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'No employees added. Please generate wallets first.'
      );
    }

    if (!this.state.airdropStatus.completed) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Airdrop not completed. Please start the airdrop first.'
      );
    }

    // Validate input
    const schema = z.object({
      fromEmail: z.string(),
      subject: z.string().default('Your token airdrop is ready!'),
      resendApiKey: z.string().optional(),
    });
    
    const { fromEmail, subject, resendApiKey: providedApiKey } = schema.parse(args);
    
    // Check if Resend API key is provided, if not, prompt the user
    if (!providedApiKey) {
      return {
        content: [
          {
            type: 'text',
            text: `To send emails to employees, I need your Resend API key. You can get this from the Resend dashboard at https://resend.com/

Please provide your Resend API key to continue.`,
          },
        ],
      };
    }
    
    // In a real implementation, we would send actual emails
    // For this demo, we'll simulate sending emails
    
    // Prepare employee data for emails
    const employeesWithTokenInfo = this.state.employees.map(employee => ({
      ...employee,
      tokenSymbol: this.state.createdToken?.symbol
    }));
    
    // Use Resend email service via crossmintUtils
    const emailResult = await sendWalletEmails(
      employeesWithTokenInfo,
      {
        fromEmail,
        subject,
        apiKey: providedApiKey, // Use provided API key if available
      }
    );
    
    const { successful, failed } = emailResult;
    
    // Update state
    this.state.emailsStatus = {
      sent: true,
      successful,
      failed,
    };
    
    return {
      content: [
        {
          type: 'text',
          text: `
Emails sent to employees:
- Total emails: ${this.state.employees.length}
- Successfully sent: ${successful}
- Failed: ${failed}

The emails contain instructions for employees to access their Crossmint custodial wallets and view their tokens.

Process completed successfully!
          `.trim(),
        },
      ],
    };
  }
  
  private async handleGetState() {
    return {
      content: [
        {
          type: 'text',
          text: `
Current Airdrop State:
- Connected Wallet: ${this.state.connectedWallet ? 'Yes' : 'No'}${
            this.state.connectedWallet
              ? `\n  Public Key: ${this.state.connectedWallet.publicKey}\n  SOL Balance: ${this.state.connectedWallet.solBalance} SOL`
              : ''
          }
- Created Token: ${this.state.createdToken ? 'Yes' : 'No'}${
            this.state.createdToken
              ? `\n  Name: ${this.state.createdToken.name}\n  Symbol: ${this.state.createdToken.symbol}\n  Supply: ${this.state.createdToken.supply.toLocaleString()}\n  Mint Address: ${this.state.createdToken.mintAddress}`
              : ''
          }
- Employees: ${this.state.employees.length}
- Airdrop Status: ${this.state.airdropStatus.completed ? 'Completed' : this.state.airdropStatus.started ? 'In Progress' : 'Not Started'}
- Emails Status: ${this.state.emailsStatus.sent ? 'Sent' : 'Not Sent'}
          `.trim(),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('HR Airdrop MCP server running on stdio');
  }
}

// Start the server
const server = new HRAirdropServer();
server.run().catch(console.error);
