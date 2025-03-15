import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getOrCreateAssociatedTokenAccount,
  mintTo
} from '@solana/spl-token';

/**
 * Deploy a new SPL token on Solana
 * 
 * @param connection Solana connection
 * @param payer Keypair of the payer/creator
 * @param name Name of the token
 * @param symbol Symbol of the token
 * @param supply Initial supply to mint
 * @param decimals Number of decimals for the token (default: 9)
 * @returns Object containing token mint address
 */
export async function deployToken(
  connection: Connection,
  payer: Keypair,
  name: string,
  symbol: string,
  supply: number,
  decimals: number = 9
): Promise<{ mintAddress: string }> {
  try {
    console.log(`Creating token: ${name} (${symbol}) with supply ${supply}`);
    
    // Check payer balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log(`Payer balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.05 * LAMPORTS_PER_SOL) {
      throw new Error(`Insufficient balance: ${balance / LAMPORTS_PER_SOL} SOL. Need at least 0.05 SOL.`);
    }
    
    // Generate a new keypair for the mint account
    const mintKeypair = Keypair.generate();
    console.log(`Mint keypair generated: ${mintKeypair.publicKey.toString()}`);
    
    // Get the minimum lamports required for the mint
    const lamports = await getMinimumBalanceForRentExemptMint(connection);
    
    // Create a transaction to create the mint account
    const transaction = new Transaction();
    
    // Add instruction to create the mint account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      })
    );
    
    // Add instruction to initialize the mint account
    transaction.add(
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        payer.publicKey,
        payer.publicKey
      )
    );
    
    // If supply is greater than 0, mint tokens to the payer
    if (supply > 0) {
      // Get the associated token account for the payer
      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        payer.publicKey
      );
      
      // Add instruction to create the associated token account if it doesn't exist
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          associatedTokenAccount,
          payer.publicKey,
          mintKeypair.publicKey
        )
      );
      
      // Add instruction to mint tokens to the payer's associated token account
      transaction.add(
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedTokenAccount,
          payer.publicKey,
          supply * Math.pow(10, decimals)
        )
      );
    }
    
    // Send and confirm the transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [payer, mintKeypair]
    );
    
    console.log(`Transaction signature: ${signature}`);
    
    // Return the mint address
    const mint = mintKeypair.publicKey;
    
    console.log(`Token mint created: ${mint.toString()}`);
    
    return {
      mintAddress: mint.toString()
    };
  } catch (error: any) {
    console.error('Error deploying token:', error);
    throw new Error(`Token deployment failed: ${error.message}`);
  }
}
