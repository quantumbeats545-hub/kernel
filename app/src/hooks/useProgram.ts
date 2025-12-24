'use client';

import { useMemo } from 'react';
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import { KERNEL_PROGRAM_ID } from '@/lib/constants';
import idl from '@/lib/kernel_token.json';

export type KernelProgram = Program<Idl>;

export function useAnchorProvider(): AnchorProvider | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
    });
  }, [connection, wallet]);
}

export function useKernelProgram(): KernelProgram | null {
  const provider = useAnchorProvider();

  return useMemo(() => {
    if (!provider) return null;
    return new Program(idl as Idl, provider);
  }, [provider]);
}

export { useAnchorWallet };
