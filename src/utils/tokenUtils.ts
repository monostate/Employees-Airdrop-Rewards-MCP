import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { deployToken } from './deployToken.js';
import { addLiquidity } from './addLiquidity.js';

// Load environment variables
dotenv.config();

// Use relative paths instead of import.meta
const projectRoot = process.cwd();
const solanaAgentKitPath = path.join(projectRoot, 'solana-agent-kit');

// Default RPC URLs
const DEFAULT_SOLANA_RPC_URL = 'https://api.devnet.solana.com';
// Helius RPC URL for compressed airdrops (rate limited to 500k requests per month and 10 Requests/sec)
// It's recommended to get your own API key or paid plan at helius.dev
const DEFAULT_HELIUS_RPC_URL = 'https://devnet.helius-rpc.com/?api-key=471d92ec-a326-49b2-a911-9e4c20645554';

// Get RPC URLs from environment variables or use defaults
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || DEFAULT_SOLANA_RPC_URL;
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || DEFAULT_HELIUS_RPC_URL;

/**
 * Create a new token on Solana
 */
export { deployToken as createToken };

/**
 * Add liquidity to a token
 */
export { addLiquidity };

/**
 * Send compressed airdrop to multiple recipients
 */
import { sendCompressedAirdrop } from './compressedAirdrop.js';
export { sendCompressedAirdrop };

/**
 * Calculate the estimated gas fees for an airdrop
 */
export function calculateAirdropFees(numberOfRecipients: number): {
  accountCreationFee: number;
  transactionFee: number;
  totalFees: number;
} {
  // Based on the compressed airdrop cost model
  const accountCreationFee = 0.00001 * numberOfRecipients; // ~0.00001 SOL per account
  const transactionFee = 0.000005 * numberOfRecipients; // ~0.000005 SOL per signature
  const totalFees = accountCreationFee + transactionFee;
  
  return {
    accountCreationFee,
    transactionFee,
    totalFees
  };
}
