'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Navbar from '@/components/Navbar';
import { LoadingSpinner, SkeletonBox } from '@/components/LoadingSpinner';
import { useAirdropData, useAirdropActions } from '@/hooks/useAirdrop';
import { NETWORK, getExplorerUrl } from '@/lib/constants';

export default function AirdropPage() {
  const { connected } = useWallet();
  const { eligibility, totalAirdropped, totalRecipients, isLoading, error } = useAirdropData();
  const { claim, isProcessing, error: claimError, clearError } = useAirdropActions();
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toLocaleString();
  };

  const handleClaim = async () => {
    try {
      clearError();
      const sig = await claim();
      setTxSignature(sig);
    } catch (err) {
      console.error('Claim failed:', err);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Network Badge */}
          {NETWORK === 'devnet' && (
            <div className="text-center mb-4">
              <span className="inline-block px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full">
                Devnet
              </span>
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">🎁</div>
            <h1 className="text-4xl font-bold text-[#FFD700] mb-2">$KERNEL Airdrop</h1>
            <p className="text-gray-400">Check your eligibility and claim your tokens!</p>
          </div>

          {/* Global Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-[#16213E] rounded-xl p-6 border border-[#FFD700]/20 text-center">
              <p className="text-gray-400 text-sm mb-1">Total Airdropped</p>
              {isLoading ? (
                <SkeletonBox className="w-24 h-8 mx-auto" />
              ) : (
                <p className="text-2xl font-bold text-[#FFD700]">{formatNumber(totalAirdropped)}</p>
              )}
            </div>
            <div className="bg-[#16213E] rounded-xl p-6 border border-[#FFD700]/20 text-center">
              <p className="text-gray-400 text-sm mb-1">Recipients</p>
              {isLoading ? (
                <SkeletonBox className="w-16 h-8 mx-auto" />
              ) : (
                <p className="text-2xl font-bold text-[#FFD700]">{totalRecipients.toLocaleString()}</p>
              )}
            </div>
          </div>

          {/* Eligibility Check */}
          <div className="bg-[#16213E] rounded-xl p-8 border border-[#FFD700]/20">
            {!connected ? (
              <div className="text-center">
                <div className="text-5xl mb-4">🔗</div>
                <h2 className="text-xl font-bold text-white mb-4">Connect Your Wallet</h2>
                <p className="text-gray-400 mb-6">
                  Connect your wallet to check if you&apos;re eligible for the $KERNEL airdrop.
                </p>
                <WalletMultiButton className="!bg-[#FFD700] !text-[#1A1A2E] hover:!bg-[#FFC000]" />
              </div>
            ) : isLoading ? (
              <div className="text-center">
                <LoadingSpinner size="lg" />
                <p className="text-gray-400 mt-4">Checking eligibility...</p>
              </div>
            ) : error ? (
              <div className="text-center">
                <div className="text-5xl mb-4">⚠️</div>
                <p className="text-red-400">{error}</p>
              </div>
            ) : txSignature ? (
              <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-[#FFD700] mb-2">Airdrop Claimed!</h2>
                <p className="text-gray-400 mb-4">
                  You&apos;ve successfully claimed your $KERNEL tokens.
                </p>
                <a
                  href={getExplorerUrl(txSignature, 'tx')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FFD700] hover:underline"
                >
                  View Transaction →
                </a>
              </div>
            ) : eligibility?.hasClaimed ? (
              <div className="text-center">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-white mb-2">Already Claimed</h2>
                <p className="text-gray-400">
                  You&apos;ve already claimed your $KERNEL airdrop. Enjoy staking!
                </p>
              </div>
            ) : eligibility?.isEligible ? (
              <div className="text-center">
                <div className="text-6xl mb-4 animate-bounce">🎁</div>
                <h2 className="text-2xl font-bold text-[#FFD700] mb-2">You&apos;re Eligible!</h2>
                <p className="text-gray-400 mb-2">You can claim:</p>
                <p className="text-4xl font-bold text-white mb-6">
                  {formatNumber(eligibility.claimableAmount)} <span className="text-[#FFD700]">KERNEL</span>
                </p>

                {claimError && (
                  <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm">{claimError}</p>
                  </div>
                )}

                <button
                  onClick={handleClaim}
                  disabled={isProcessing}
                  className="px-8 py-4 bg-[#FFD700] text-[#1A1A2E] font-bold rounded-lg hover:bg-[#FFC000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                >
                  {isProcessing ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      🎁 Claim Airdrop
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-6xl mb-4">😢</div>
                <h2 className="text-2xl font-bold text-white mb-2">Not Eligible</h2>
                <p className="text-gray-400 mb-4">
                  Unfortunately, this wallet is not eligible for the airdrop.
                </p>
                <p className="text-sm text-gray-500">
                  Don&apos;t worry! You can still buy $KERNEL on a DEX and stake to earn reflections.
                </p>
              </div>
            )}
          </div>

          {/* Eligibility Criteria */}
          <div className="mt-8 bg-[#16213E]/50 rounded-xl p-6 border border-[#FFD700]/10">
            <h3 className="text-lg font-bold text-[#FFD700] mb-4">Eligibility Criteria</h3>
            <ul className="space-y-3 text-gray-400">
              <li className="flex items-start gap-3">
                <span className="text-[#FFD700]">✓</span>
                <span>Early Discord/Twitter community members</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#FFD700]">✓</span>
                <span>Testnet staking participants</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#FFD700]">✓</span>
                <span>NFT holders from partner collections</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[#FFD700]">✓</span>
                <span>Active Solana DeFi users (min 10 txs)</span>
              </li>
            </ul>
          </div>

          {/* Timeline */}
          <div className="mt-8 bg-[#16213E]/50 rounded-xl p-6 border border-[#FFD700]/10">
            <h3 className="text-lg font-bold text-[#FFD700] mb-4">Airdrop Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-[#FFD700] flex items-center justify-center text-[#1A1A2E] font-bold">1</div>
                <div>
                  <p className="text-white font-semibold">Snapshot</p>
                  <p className="text-gray-400 text-sm">Completed - Dec 2024</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-[#FFD700] flex items-center justify-center text-[#1A1A2E] font-bold">2</div>
                <div>
                  <p className="text-white font-semibold">Claim Period</p>
                  <p className="text-gray-400 text-sm">Now Live - 30 days remaining</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold">3</div>
                <div>
                  <p className="text-gray-400 font-semibold">Unclaimed Burn</p>
                  <p className="text-gray-500 text-sm">Unclaimed tokens will be burned</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
