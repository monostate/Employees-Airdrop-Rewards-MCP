import axios from 'axios';

/**
 * Create a Solana custodial wallet using Crossmint API
 * 
 * @param apiKey Crossmint API key
 * @param email Email to associate with the wallet (optional)
 * @returns The created wallet data
 */
export async function createCrossmintWallet(apiKey: string, email?: string): Promise<any> {
  try {
    console.log('Creating Solana custodial wallet via Crossmint API');
    
    // Determine if we're using staging or production based on API key
    const isStaging = apiKey.includes('staging');
    const baseUrl = isStaging 
      ? 'https://staging.crossmint.com/api/2022-06-09/wallets'
      : 'https://www.crossmint.com/api/2022-06-09/wallets';
    
    // Set up the request body with required linkedUser parameter in the correct format
    const requestBody: any = {
      type: 'solana-mpc-wallet', // Use MPC wallet for email-based custodial wallets
      linkedUser: email ? `email:${email}` : `userId:user-${Date.now()}` // Required format for custodial wallets
    };
    
    // Make the API request
    const response = await axios.post(baseUrl, requestBody, {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      }
    });
    
    // Log success
    console.log(`Successfully created Solana wallet: ${response.data.walletId}`);
    
    return response.data;
  } catch (error: unknown) {
    // Streamlined error logging to avoid overwhelming the terminal
    if (axios.isAxiosError(error) && error.response) {
      console.error('Crossmint API Error:', error.response.status, error.response.data);
      throw new Error(`Crossmint API error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error('Error creating Crossmint wallet:', error instanceof Error ? error.message : String(error));
    }
    
    throw error;
  }
}

/**
 * Get a Solana custodial wallet by email using Crossmint API
 * 
 * @param apiKey Crossmint API key
 * @param email Email associated with the wallet
 * @returns The wallet data
 */
export async function getCrossmintWalletByEmail(apiKey: string, email: string): Promise<any> {
  try {
    console.log(`Getting Solana custodial wallet for email: ${email}`);
    
    // Determine if we're using staging or production based on API key
    const isStaging = apiKey.includes('staging');
    const baseUrl = isStaging 
      ? 'https://staging.crossmint.com/api/2022-06-09/wallets'
      : 'https://www.crossmint.com/api/2022-06-09/wallets';
    
    // Make the API request to search for wallets by email
    const response = await axios.get(`${baseUrl}?email=${encodeURIComponent(email)}`, {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      }
    });
    
    // Check if any wallets were found
    if (response.data.wallets && response.data.wallets.length > 0) {
      // Find the first Solana wallet
      const solanaWallet = response.data.wallets.find((wallet: any) => 
        wallet.type.startsWith('solana-')
      );
      
      if (solanaWallet) {
        console.log(`Found Solana wallet for ${email}: ${solanaWallet.walletId}`);
        return solanaWallet;
      }
    }
    
    // No wallet found
    throw new Error(`No Solana wallet found for email: ${email}`);
  } catch (error: unknown) {
    // Streamlined error logging to avoid overwhelming the terminal
    if (axios.isAxiosError(error) && error.response) {
      console.error('Crossmint API Error:', error.response.status, error.response.data);
      throw new Error(`Crossmint API error: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`Error getting wallet for ${email}:`, error instanceof Error ? error.message : String(error));
    }
    
    throw error;
  }
}
