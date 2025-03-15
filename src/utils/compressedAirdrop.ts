import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction, clusterApiUrl } from '@solana/web3.js';
import { 
  createTransferInstruction, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';

/**
 * Send tokens to multiple recipients using a compressed format
 * 
 * This is a simplified version that sends tokens to multiple recipients
 * In a real implementation, this would use the Light Protocol for compressed transactions
 * 
 * @param connection Solana connection
 * @param sender Keypair of the sender
 * @param mintAddress Address of the token mint
 * @param amount Default amount to send to each recipient
 * @param decimals Number of decimals for the token
 * @param recipients List of recipients with their addresses and optional custom amounts
 * @returns Object containing transaction IDs
 */
export async function sendCompressedAirdrop(
  connection: Connection,
  sender: Keypair,
  mintAddress: string,
  amount: number,
  decimals: number,
  recipients: { address: string, email: string, amount?: number }[],
  heliusApiKey?: string
): Promise<{ txIds: string[] }> {
  // Use Helius RPC for compressed transactions if API key is provided
  const heliusConnection = heliusApiKey 
    ? new Connection(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, 'confirmed')
    : connection;
  try {
    console.log(`Sending airdrop to ${recipients.length} recipients`);
    console.log(`Using ${heliusApiKey ? 'Helius' : 'default'} RPC for compressed transactions`);
    
    // Convert mintAddress string to PublicKey
    const mintPublicKey = new PublicKey(mintAddress);
    
    // Get the sender's token account
    const senderTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      sender.publicKey
    );
    
    // Check if the sender's token account exists
    try {
      await getAccount(connection, senderTokenAccount);
    } catch (error) {
      throw new Error(`Sender's token account does not exist: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Batch recipients into groups of 5 (to avoid transaction size limits)
    const batchSize = 5;
    const batches = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      batches.push(recipients.slice(i, i + batchSize));
    }
    
    console.log(`Processing ${batches.length} batches of recipients`);
    
    // Process each batch
    const txIds = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} recipients`);
      
      // Create a transaction for this batch
      const transaction = new Transaction();
      
      // Add transfer instructions for each recipient in the batch
      for (const recipient of batch) {
        // Convert recipient address string to PublicKey
        const recipientPublicKey = new PublicKey(recipient.address);
        
        // Get the recipient's token account
        const recipientTokenAccount = await getAssociatedTokenAddress(
          mintPublicKey,
          recipientPublicKey
        );
        
        // Check if the recipient's token account exists
        let recipientAccountExists = true;
        try {
          await getAccount(connection, recipientTokenAccount);
        } catch (error) {
          recipientAccountExists = false;
        }
        
        // If the recipient's token account doesn't exist, create it
        if (!recipientAccountExists) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              sender.publicKey,
              recipientTokenAccount,
              recipientPublicKey,
              mintPublicKey
            )
          );
        }
        
        // Calculate the amount to send (use the recipient's custom amount if provided)
        const sendAmount = (recipient.amount || amount) * Math.pow(10, decimals);
        
        // Add the transfer instruction
        transaction.add(
          createTransferInstruction(
            senderTokenAccount,
            recipientTokenAccount,
            sender.publicKey,
            sendAmount
          )
        );
      }
      
      // Send the transaction
      try {
        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [sender]
        );
        
        console.log(`Batch ${i + 1} sent with transaction ID: ${signature}`);
        txIds.push(signature);
      } catch (error) {
        console.error(`Error sending batch ${i + 1}:`, error);
        throw error;
      }
    }
    
    return { txIds };
  } catch (error) {
    console.error('Error sending compressed airdrop:', error);
    throw new Error(`Compressed airdrop failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
