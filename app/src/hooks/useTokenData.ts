'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import {
  getMint,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { KERNEL_MINT, KERNEL_DECIMALS, KERNEL_TOTAL_SUPPLY } from '@/lib/constants';

export interface TokenData {
  currentSupply: number;
  totalBurned: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTokenData(): TokenData {
  const { connection } = useConnection();
  const [currentSupply, setCurrentSupply] = useState<number>(KERNEL_TOTAL_SUPPLY);
  const [totalBurned, setTotalBurned] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const mintInfo = await getMint(
        connection,
        KERNEL_MINT,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );

      const supply = Number(mintInfo.supply) / Math.pow(10, KERNEL_DECIMALS);
      setCurrentSupply(supply);
      setTotalBurned(KERNEL_TOTAL_SUPPLY - supply);
    } catch (err) {
      console.error('Error fetching token data:', err);
      setError('Failed to fetch token data');
      // Use defaults on error
      setCurrentSupply(KERNEL_TOTAL_SUPPLY * 0.9); // Assume 10% burned
      setTotalBurned(KERNEL_TOTAL_SUPPLY * 0.1);
    } finally {
      setIsLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    fetchTokenData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTokenData, 30000);
    return () => clearInterval(interval);
  }, [fetchTokenData]);

  return {
    currentSupply,
    totalBurned,
    isLoading,
    error,
    refetch: fetchTokenData,
  };
}

export interface UserBalance {
  balance: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserBalance(): UserBalance {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!connected || !publicKey) {
      setBalance(0);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const ata = getAssociatedTokenAddressSync(
        KERNEL_MINT,
        publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      try {
        const account = await getAccount(
          connection,
          ata,
          'confirmed',
          TOKEN_2022_PROGRAM_ID
        );
        setBalance(Number(account.amount) / Math.pow(10, KERNEL_DECIMALS));
      } catch {
        // Account doesn't exist = 0 balance
        setBalance(0);
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
      setError('Failed to fetch balance');
      setBalance(0);
    } finally {
      setIsLoading(false);
    }
  }, [connection, publicKey, connected]);

  useEffect(() => {
    fetchBalance();
    // Refresh every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance,
  };
}
