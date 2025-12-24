'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { KERNEL_PROGRAM_ID, KERNEL_MINT, KERNEL_DECIMALS } from '@/lib/constants';

// PDA Seeds - must match the on-chain program
const CONFIG_SEED = 'config';
const USER_STAKE_SEED = 'stake'; // Program uses "stake", not "user_stake"

// Derive PDAs
export function getConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED), KERNEL_MINT.toBuffer()],
    KERNEL_PROGRAM_ID
  );
}

export function getUserStakePDA(owner: PublicKey): [PublicKey, number] {
  const [configPDA] = getConfigPDA();
  return PublicKey.findProgramAddressSync(
    [Buffer.from(USER_STAKE_SEED), configPDA.toBuffer(), owner.toBuffer()],
    KERNEL_PROGRAM_ID
  );
}

export interface StakingData {
  stakedAmount: number;
  pendingRewards: number;
  totalClaimed: number;
  stakeTime: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface GlobalStakingData {
  totalStaked: number;
  totalReflectionsDistributed: number;
  pendingReflections: number;
  isPaused: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStakingData(): StakingData {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [data, setData] = useState<Omit<StakingData, 'refetch'>>({
    stakedAmount: 0,
    pendingRewards: 0,
    totalClaimed: 0,
    stakeTime: null,
    isLoading: false,
    error: null,
  });

  const fetchStakingData = useCallback(async () => {
    if (!connected || !publicKey) {
      setData(prev => ({ ...prev, stakedAmount: 0, pendingRewards: 0, totalClaimed: 0, stakeTime: null }));
      return;
    }

    try {
      setData(prev => ({ ...prev, isLoading: true, error: null }));

      const [userStakePDA] = getUserStakePDA(publicKey);

      try {
        const accountInfo = await connection.getAccountInfo(userStakePDA);

        if (accountInfo) {
          // Parse UserStake account data
          // Layout: discriminator (8) + owner (32) + staked_amount (8) + stake_time (8) +
          //         pending_rewards (8) + total_claimed (8) + reward_debt (16) + bump (1)
          const dataBuffer = accountInfo.data;

          const stakedAmount = Number(dataBuffer.readBigUInt64LE(40)) / Math.pow(10, KERNEL_DECIMALS);
          const stakeTime = Number(dataBuffer.readBigInt64LE(48));
          const pendingRewards = Number(dataBuffer.readBigUInt64LE(56)) / Math.pow(10, KERNEL_DECIMALS);
          const totalClaimed = Number(dataBuffer.readBigUInt64LE(64)) / Math.pow(10, KERNEL_DECIMALS);

          setData({
            stakedAmount,
            pendingRewards,
            totalClaimed,
            stakeTime: stakeTime > 0 ? stakeTime * 1000 : null,
            isLoading: false,
            error: null,
          });
        } else {
          // No stake account = no stake
          setData({
            stakedAmount: 0,
            pendingRewards: 0,
            totalClaimed: 0,
            stakeTime: null,
            isLoading: false,
            error: null,
          });
        }
      } catch (err) {
        // Account doesn't exist
        setData({
          stakedAmount: 0,
          pendingRewards: 0,
          totalClaimed: 0,
          stakeTime: null,
          isLoading: false,
          error: null,
        });
      }
    } catch (err) {
      console.error('Error fetching staking data:', err);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to fetch staking data',
      }));
    }
  }, [connection, publicKey, connected]);

  useEffect(() => {
    fetchStakingData();
    const interval = setInterval(fetchStakingData, 15000);
    return () => clearInterval(interval);
  }, [fetchStakingData]);

  return { ...data, refetch: fetchStakingData };
}

export function useGlobalStakingData(): GlobalStakingData {
  const { connection } = useConnection();
  const [data, setData] = useState<Omit<GlobalStakingData, 'refetch'>>({
    totalStaked: 0,
    totalReflectionsDistributed: 0,
    pendingReflections: 0,
    isPaused: false,
    isLoading: true,
    error: null,
  });

  const fetchGlobalData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, isLoading: true, error: null }));

      const [configPDA] = getConfigPDA();

      try {
        const accountInfo = await connection.getAccountInfo(configPDA);

        if (accountInfo) {
          // Parse KernelConfig account data
          // Layout: discriminator (8) + authority (32) + token_mint (32) + staking_vault (32) + reflection_pool (32) +
          //         reflection_share_bps (2) + lp_share_bps (2) + burn_share_bps (2) +
          //         total_staked (8) + total_reflections_distributed (8) + pending_reflections (8) +
          //         accumulated_per_share (16) + is_paused (1) + bump (1) + vault_bump (1)
          const dataBuffer = accountInfo.data;
          const offset = 8 + 32 + 32 + 32 + 32 + 2 + 2 + 2; // 142 (with discriminator)

          const totalStaked = Number(dataBuffer.readBigUInt64LE(offset)) / Math.pow(10, KERNEL_DECIMALS);
          const totalReflectionsDistributed = Number(dataBuffer.readBigUInt64LE(offset + 8)) / Math.pow(10, KERNEL_DECIMALS);
          const pendingReflections = Number(dataBuffer.readBigUInt64LE(offset + 16)) / Math.pow(10, KERNEL_DECIMALS);
          // Skip accumulated_per_share (16 bytes at offset + 24)
          const isPaused = dataBuffer[offset + 40] === 1;

          setData({
            totalStaked,
            totalReflectionsDistributed,
            pendingReflections,
            isPaused,
            isLoading: false,
            error: null,
          });
        } else {
          // Program not initialized yet
          setData({
            totalStaked: 0,
            totalReflectionsDistributed: 0,
            pendingReflections: 0,
            isPaused: false,
            isLoading: false,
            error: 'Program not initialized',
          });
        }
      } catch {
        setData(prev => ({
          ...prev,
          isLoading: false,
          error: 'Config account not found',
        }));
      }
    } catch (err) {
      console.error('Error fetching global staking data:', err);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to fetch global data',
      }));
    }
  }, [connection]);

  useEffect(() => {
    fetchGlobalData();
    const interval = setInterval(fetchGlobalData, 30000);
    return () => clearInterval(interval);
  }, [fetchGlobalData]);

  return { ...data, refetch: fetchGlobalData };
}

// Calculate estimated APY based on reflection rate and total staked
export function calculateEstimatedAPY(
  totalStaked: number,
  dailyVolume: number = 1_000_000 // Estimate
): number {
  if (totalStaked <= 0) return 0;

  // 2% of volume goes to reflections
  const dailyReflections = dailyVolume * 0.02;
  // Annual reflections
  const annualReflections = dailyReflections * 365;
  // APY = annual reflections / total staked * 100
  const apy = (annualReflections / totalStaked) * 100;

  return Math.min(apy, 1000); // Cap at 1000% for display
}
