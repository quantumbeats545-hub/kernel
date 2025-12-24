'use client';

import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { useKernelProgram } from './useProgram';
import { KERNEL_MINT, KERNEL_PROGRAM_ID, KERNEL_DECIMALS } from '@/lib/constants';

// PDA Seeds - must match program
const CONFIG_SEED = 'config';
const USER_STAKE_SEED = 'stake'; // Program uses "stake", not "user_stake"
const STAKING_VAULT_SEED = 'staking_vault';
const REFLECTION_POOL_SEED = 'reflection_pool';

// Derive PDAs
export function getConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );
}

export function getStakingVaultPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(STAKING_VAULT_SEED), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );
}

export function getReflectionPoolPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(REFLECTION_POOL_SEED), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );
}

export function getUserStakePDA(owner: PublicKey): [PublicKey, number] {
  const [configPda] = getConfigPDA();
  return PublicKey.findProgramAddressSync(
    [Buffer.from(USER_STAKE_SEED), configPda.toBuffer(), owner.toBuffer()],
    KERNEL_PROGRAM_ID
  );
}

export interface StakingActions {
  stake: (amount: number) => Promise<string>;
  unstake: (amount: number) => Promise<string>;
  claimReflections: () => Promise<string>;
  isProcessing: boolean;
  error: string | null;
  clearError: () => void;
}

export function useStakingActions(): StakingActions {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const program = useKernelProgram();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const stake = useCallback(async (amount: number): Promise<string> => {
    if (!publicKey || !program) {
      throw new Error('Wallet not connected');
    }

    setIsProcessing(true);
    setError(null);

    try {
      const amountBN = new BN(amount * Math.pow(10, KERNEL_DECIMALS));
      const [configPda] = getConfigPDA();
      const [stakingVaultPda] = getStakingVaultPDA();
      const [userStakePda] = getUserStakePDA(publicKey);

      // Get user's token account
      const userTokenAccount = getAssociatedTokenAddressSync(
        KERNEL_MINT,
        publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .stake(amountBN)
        .accounts({
          owner: publicKey,
          config: configPda,
          userStake: userStakePda,
          userTokenAccount,
          stakingVault: stakingVaultPda,
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
      const message = err instanceof Error ? err.message : 'Failed to stake';
      setError(message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [publicKey, program, connection, sendTransaction]);

  const unstake = useCallback(async (amount: number): Promise<string> => {
    if (!publicKey || !program) {
      throw new Error('Wallet not connected');
    }

    setIsProcessing(true);
    setError(null);

    try {
      const amountBN = new BN(amount * Math.pow(10, KERNEL_DECIMALS));
      const [configPda] = getConfigPDA();
      const [stakingVaultPda] = getStakingVaultPDA();
      const [userStakePda] = getUserStakePDA(publicKey);

      // Get user's token account
      const userTokenAccount = getAssociatedTokenAddressSync(
        KERNEL_MINT,
        publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .unstake(amountBN)
        .accounts({
          owner: publicKey,
          config: configPda,
          userStake: userStakePda,
          userTokenAccount,
          stakingVault: stakingVaultPda,
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
      const message = err instanceof Error ? err.message : 'Failed to unstake';
      setError(message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [publicKey, program, connection, sendTransaction]);

  const claimReflections = useCallback(async (): Promise<string> => {
    if (!publicKey || !program) {
      throw new Error('Wallet not connected');
    }

    setIsProcessing(true);
    setError(null);

    try {
      const [configPda] = getConfigPDA();
      const [reflectionPoolPda] = getReflectionPoolPDA();
      const [userStakePda] = getUserStakePDA(publicKey);

      // Get user's token account
      const userTokenAccount = getAssociatedTokenAddressSync(
        KERNEL_MINT,
        publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .claimReflections()
        .accounts({
          owner: publicKey,
          config: configPda,
          userStake: userStakePda,
          userTokenAccount,
          reflectionPool: reflectionPoolPda,
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
      const message = err instanceof Error ? err.message : 'Failed to claim';
      setError(message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [publicKey, program, connection, sendTransaction]);

  return {
    stake,
    unstake,
    claimReflections,
    isProcessing,
    error,
    clearError,
  };
}
