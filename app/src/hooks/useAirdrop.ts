'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { useKernelProgram } from './useProgram';
import { KERNEL_MINT, KERNEL_PROGRAM_ID, KERNEL_DECIMALS } from '@/lib/constants';

export interface AirdropEligibility {
  isEligible: boolean;
  claimableAmount: number;
  hasClaimed: boolean;
  claimIndex: number;
  proof: number[][] | null;
}

export interface AirdropData {
  eligibility: AirdropEligibility | null;
  totalAirdropped: number;
  totalRecipients: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface AirdropActions {
  claim: () => Promise<string>;
  isProcessing: boolean;
  error: string | null;
  clearError: () => void;
}

// Get airdrop state PDA
function getAirdropStatePDA(): [PublicKey, number] {
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config'), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );
  return PublicKey.findProgramAddressSync(
    [Buffer.from('airdrop'), configPda.toBuffer()],
    KERNEL_PROGRAM_ID
  );
}

// Get user claim PDA
function getUserClaimPDA(user: PublicKey): [PublicKey, number] {
  const [airdropState] = getAirdropStatePDA();
  return PublicKey.findProgramAddressSync(
    [Buffer.from('claim'), airdropState.toBuffer(), user.toBuffer()],
    KERNEL_PROGRAM_ID
  );
}

export function useAirdropData(): AirdropData {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [data, setData] = useState<Omit<AirdropData, 'refetch'>>({
    eligibility: null,
    totalAirdropped: 0,
    totalRecipients: 0,
    isLoading: false,
    error: null,
  });

  const fetchAirdropData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch airdrop state
      const [airdropStatePda] = getAirdropStatePDA();
      let totalAirdropped = 0;
      let totalRecipients = 0;

      try {
        const airdropAccount = await connection.getAccountInfo(airdropStatePda);
        if (airdropAccount && airdropAccount.data.length >= 48) {
          // Parse: discriminator (8) + authority (32) + merkle_root (32) + total_claimed (8) + claim_count (8)
          totalAirdropped = Number(airdropAccount.data.readBigUInt64LE(72)) / Math.pow(10, KERNEL_DECIMALS);
          totalRecipients = Number(airdropAccount.data.readBigUInt64LE(80));
        }
      } catch {
        // Airdrop not initialized
      }

      // Check user eligibility
      let eligibility: AirdropEligibility | null = null;

      if (connected && publicKey) {
        const [userClaimPda] = getUserClaimPDA(publicKey);

        try {
          const claimAccount = await connection.getAccountInfo(userClaimPda);
          if (claimAccount) {
            // User has already claimed
            eligibility = {
              isEligible: true,
              claimableAmount: 0,
              hasClaimed: true,
              claimIndex: 0,
              proof: null,
            };
          } else {
            // Check if user is in merkle tree (would need off-chain lookup in production)
            // For now, simulate eligibility based on wallet
            const isEligible = publicKey.toBase58().startsWith('H') || publicKey.toBase58().startsWith('7');
            eligibility = {
              isEligible,
              claimableAmount: isEligible ? 1000000 : 0, // 1M KERNEL airdrop
              hasClaimed: false,
              claimIndex: 0,
              proof: isEligible ? [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]] : null,
            };
          }
        } catch {
          // User hasn't claimed yet, check eligibility
          eligibility = {
            isEligible: false,
            claimableAmount: 0,
            hasClaimed: false,
            claimIndex: 0,
            proof: null,
          };
        }
      }

      setData({
        eligibility,
        totalAirdropped,
        totalRecipients,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error('Error fetching airdrop data:', err);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to fetch airdrop data',
      }));
    }
  }, [connection, publicKey, connected]);

  useEffect(() => {
    fetchAirdropData();
    const interval = setInterval(fetchAirdropData, 30000);
    return () => clearInterval(interval);
  }, [fetchAirdropData]);

  return { ...data, refetch: fetchAirdropData };
}

export function useAirdropActions(): AirdropActions {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const program = useKernelProgram();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const claim = useCallback(async (): Promise<string> => {
    if (!publicKey || !program) {
      throw new Error('Wallet not connected');
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('config'), KERNEL_MINT.toBuffer()],
        KERNEL_PROGRAM_ID
      );

      const [airdropStatePda] = getAirdropStatePDA();
      const [userClaimPda] = getUserClaimPDA(publicKey);

      const userTokenAccount = getAssociatedTokenAddressSync(
        KERNEL_MINT,
        publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      // In production, fetch proof from off-chain merkle tree service
      const proof: number[][] = [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];
      const amount = new BN(1000000 * Math.pow(10, KERNEL_DECIMALS)); // 1M KERNEL

      const tx = await program.methods
        .claimAirdrop(new BN(0), amount, proof)
        .accounts({
          user: publicKey,
          config: configPda,
          airdropState: airdropStatePda,
          userClaim: userClaimPda,
          userTokenAccount,
          tokenMint: KERNEL_MINT,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      const signature = await sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction(signature, 'confirmed');
      return signature;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to claim airdrop';
      setError(message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [publicKey, program, connection, sendTransaction]);

  return {
    claim,
    isProcessing,
    error,
    clearError,
  };
}
