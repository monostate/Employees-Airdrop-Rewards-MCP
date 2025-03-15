import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import https from 'https';

// Create a custom axios instance with SSL verification disabled
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});
import { crossmint } from '@goat-sdk/crossmint';
import bs58 from 'bs58';

// Path to store the token creator wallet keypair
const WALLET_PATH = path.join(process.cwd(), 'token-creator-wallet.json');

/**
 * Create or load a token creator wallet
 * 
 * @returns Keypair for the token creator wallet
 */
export function getTokenCreatorWallet(): Keypair {
  try {
    // Check if the wallet file exists
    if (fs.existsSync(WALLET_PATH)) {
      console.log('Loading existing token creator wallet...');
      const walletData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8'));
      return Keypair.fromSecretKey(new Uint8Array(walletData));
    } else {
      console.log('Creating new token creator wallet...');
      // Generate a new keypair
      const keypair = Keypair.generate();
      
      // Save the keypair to a file
      fs.writeFileSync(WALLET_PATH, JSON.stringify(Array.from(keypair.secretKey)));
      
      console.log(`Token creator wallet created: ${keypair.publicKey.toString()}`);
      console.log(`IMPORTANT: Keep the wallet file (${WALLET_PATH}) secure!`);
      
      return keypair;
    }
  } catch (error) {
    console.error('Error creating/loading token creator wallet:', error);
    throw new Error(`Failed to create/load token creator wallet: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get the balance of the token creator wallet
 * 
 * @param connection Solana connection
 * @param wallet Token creator wallet keypair
 * @returns Balance in SOL
 */
export async function getTokenCreatorWalletBalance(
  connection: Connection,
  wallet: Keypair
): Promise<number> {
  try {
    const balance = await connection.getBalance(wallet.publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error getting token creator wallet balance:', error);
    throw new Error(`Failed to get token creator wallet balance: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Transfer SOL from Crossmint wallet to token creator wallet
 * 
 * @param connection Solana connection
 * @param crossmintApiKey Crossmint API key
 * @param crossmintEmail User's email for the Crossmint wallet
 * @param tokenCreatorWallet Token creator wallet keypair
 * @param amount Amount of SOL to transfer
 * @returns Transaction signature
 */
export async function transferFromCrossmintToTokenCreator(
  connection: Connection,
  crossmintApiKey: string,
  crossmintEmail: string,
  tokenCreatorWallet: Keypair,
  amount: number
): Promise<string> {
  try {
    console.log(`Transferring ${amount} SOL from Crossmint wallet to token creator wallet...`);
    
    // Initialize Crossmint client
    const crossmintClient = crossmint(crossmintApiKey);
    
    // Get the Crossmint wallet
    const crossmintWallet = await crossmintClient.custodial({
      chain: "solana",
      connection,
      email: crossmintEmail
    });
    
    // Get the wallet address
    const crossmintWalletAddress = crossmintWallet.getAddress();
    console.log(`Crossmint wallet address: ${crossmintWalletAddress}`);
    
    // Wallet locator using email - format should be 'email:<email>:<walletType>'
    const walletLocator = `email:${crossmintEmail}:solana-mpc-wallet`;
    
    // API endpoint for creating a transaction
    // Use the correct endpoint as per documentation
    const endpoint = `https://www.crossmint.com/api/2022-06-09/wallets/${walletLocator}/transactions`;
    
    // Request headers
    const headers = {
      'Content-Type': 'application/json',
      'X-API-KEY': crossmintApiKey
    };
    
    // Create a Solana transfer transaction using VersionedTransaction
    // Use the placeholder values as specified in the documentation
    const fromPublicKey = new PublicKey(crossmintWalletAddress);
    const toPublicKey = tokenCreatorWallet.publicKey;
    const lamports = amount * LAMPORTS_PER_SOL;

    // Create instructions for the transfer
    const instructions = [
      SystemProgram.transfer({
        fromPubkey: fromPublicKey,
        toPubkey: toPublicKey,
        lamports: lamports,
      }),
    ];

    // Create a transaction with placeholder values
    const transaction = new Transaction();
    transaction.add(...instructions);
    transaction.recentBlockhash = "11111111111111111111111111111111"; // Placeholder
    transaction.feePayer = new PublicKey("11111111111111111111111111111112"); // Placeholder
    
    // Serialize the transaction to base58
    const serializedTransactionStr = bs58.encode(transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    }));

    // Create the transaction body according to Crossmint API documentation
    const body = {
      params: {
        transaction: serializedTransactionStr
      }
    };
    
    // Make the API request
    console.log(`Sending transfer request to Crossmint API...`);
    
    // Send the transaction using the Crossmint API with SSL verification disabled
    const response = await axiosInstance.post(endpoint, body, { headers });
    
    // Get the transaction ID
    const transactionId = response.data.id;
    console.log(`Transfer transaction created with ID: ${transactionId}`);
    
    // Wait for the transaction to be confirmed
    console.log(`Waiting for transfer to be confirmed...`);
    
    // Poll the transaction status
    const statusEndpoint = `${endpoint}/${transactionId}`;
    let status = "pending";
    let attempts = 0;
    const maxAttempts = 10;
    
    while (status !== "success" && attempts < maxAttempts) {
      // Respect Helius RPC rate limit (10 requests per second)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      attempts++;
      const statusResponse = await axiosInstance.get(statusEndpoint, { headers });
      status = statusResponse.data.status;
      console.log(`Transaction status (attempt ${attempts}/${maxAttempts}): ${status}`);
      
      if (status === "failed") {
        const error = statusResponse.data.error || {};
        // Check if the error is due to insufficient funds
        if (error.logs && error.logs.some((log: string) => log.includes("insufficient lamports"))) {
          throw new Error(`Transaction failed: Insufficient SOL balance in Crossmint wallet. Please add more SOL to your wallet.`);
        } else {
          throw new Error(`Transaction failed: ${JSON.stringify(error)}`);
        }
      }
    }
    
    if (status !== "success" && attempts >= maxAttempts) {
      console.log(`Transaction not confirmed after ${maxAttempts} attempts. Last status: ${status}`);
      console.log(`⚠️ The transaction may still be processing. Check the transaction status later.`);
      console.log(`⚠️ Transaction ID: ${transactionId}`);
      
      // For testing purposes, we'll still return the transaction ID
      // In a production environment, you might want to throw an error here
      if (status === "pending") {
        console.log(`⚠️ Transaction is still pending. This is normal for Solana transactions, which can take some time to confirm.`);
      }
    }
    
    return transactionId;
  } catch (error) {
    console.error('Error transferring SOL from Crossmint wallet:', error);
    throw new Error(`Failed to transfer SOL from Crossmint wallet: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Calculate the total SOL needed for token creation, liquidity addition, and airdrops
 * 
 * @param numEmployees Number of employees for the airdrop
 * @returns Total SOL needed
 */
export function calculateTotalSolNeeded(numEmployees: number): {
  tokenCreationFee: number;
  liquidityFee: number;
  raydiumFee: number;
  airdropFee: number;
  totalFee: number;
} {
  // Token creation fee (estimated)
  const tokenCreationFee = 0.01;
  
  // Liquidity fee (amount of SOL to add to the pool)
  const liquidityFee = 1;
  
  // Raydium fee for opening a liquidity pool
  const raydiumFee = 0.2;
  
  // Airdrop fee (estimated per employee)
  const airdropFeePerEmployee = 0.00001;
  const airdropFee = airdropFeePerEmployee * numEmployees;
  
  // Total fee
  const totalFee = tokenCreationFee + liquidityFee + raydiumFee + airdropFee;
  
  return {
    tokenCreationFee,
    liquidityFee,
    raydiumFee,
    airdropFee,
    totalFee
  };
}
