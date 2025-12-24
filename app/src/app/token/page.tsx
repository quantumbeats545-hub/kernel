'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { SkeletonBox } from '@/components/LoadingSpinner';
import {
  KERNEL_MINT,
  KERNEL_TOTAL_SUPPLY,
  KERNEL_SYMBOL,
  KERNEL_NAME,
  KERNEL_DECIMALS,
  TOTAL_FEE_BPS,
  REFLECTION_FEE_BPS,
  LP_FEE_BPS,
  BURN_FEE_BPS,
  NETWORK,
  getExplorerUrl,
} from '@/lib/constants';
import { useTokenData } from '@/hooks/useTokenData';
import { useGlobalStakingData, calculateEstimatedAPY } from '@/hooks/useStaking';

export default function TokenPage() {
  const [copied, setCopied] = useState(false);

  // Real data hooks
  const { currentSupply, totalBurned, isLoading: tokenLoading } = useTokenData();
  const { totalStaked, totalReflectionsDistributed, isLoading: stakingLoading } = useGlobalStakingData();

  const isLoading = tokenLoading || stakingLoading;
  const estimatedAPY = calculateEstimatedAPY(totalStaked);
  const burnPercentage = (totalBurned / KERNEL_TOTAL_SUPPLY) * 100;

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(KERNEL_MINT.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">🍿</div>
            <h1 className="text-4xl font-bold mb-2">
              <span className="text-[#FFD700]">{KERNEL_SYMBOL}</span> Token
            </h1>
            <p className="text-gray-400">
              {KERNEL_NAME} - The Core of Crypto Security
            </p>
            {NETWORK === 'devnet' && (
              <span className="inline-block mt-4 px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full">
                Devnet
              </span>
            )}
          </div>

          {/* Contract Address */}
          <div className="bg-[#16213E] rounded-xl p-4 mb-8 border border-[#FFD700]/20">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="text-gray-400 text-sm mb-1">
                  Token Address ({NETWORK === 'devnet' ? 'Devnet' : 'Mainnet'})
                </p>
                <a
                  href={getExplorerUrl(KERNEL_MINT.toString())}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FFD700] font-mono text-sm break-all hover:underline"
                >
                  {KERNEL_MINT.toString()}
                </a>
              </div>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-[#1A1A2E] rounded-lg text-sm font-medium hover:bg-[#FFD700]/10 transition-colors whitespace-nowrap"
              >
                {copied ? '✓ Copied!' : 'Copy Address'}
              </button>
            </div>
          </div>

          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Supply" value={formatNumber(KERNEL_TOTAL_SUPPLY)} loading={false} />
            <StatCard label="Circulating" value={formatNumber(currentSupply)} loading={isLoading} />
            <StatCard label="Total Burned" value={formatNumber(totalBurned)} highlight color="#FF4444" loading={isLoading} />
            <StatCard label="Total Staked" value={formatNumber(totalStaked)} loading={isLoading} />
          </div>

          {/* Burn Progress */}
          <div className="bg-[#16213E] rounded-xl p-6 mb-8 border border-[#FFD700]/20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Burn Progress</h3>
              {isLoading ? (
                <SkeletonBox className="w-24 h-6" />
              ) : (
                <span className="text-[#FF4444] font-bold">{burnPercentage.toFixed(2)}% Burned</span>
              )}
            </div>
            <div className="h-4 bg-[#1A1A2E] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FF6B35] to-[#FF4444] rounded-full transition-all duration-500"
                style={{ width: isLoading ? '0%' : `${Math.min(burnPercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-400">
              <span>0</span>
              <span>{isLoading ? '...' : `${formatNumber(totalBurned)} burned`}</span>
              <span>{formatNumber(KERNEL_TOTAL_SUPPLY)}</span>
            </div>
          </div>

          {/* Token Details */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Token Info */}
            <div className="bg-[#16213E] rounded-xl p-6 border border-[#FFD700]/20">
              <h3 className="text-xl font-bold text-[#FFD700] mb-4">Token Details</h3>
              <div className="space-y-3">
                <DetailRow label="Name" value={KERNEL_NAME} />
                <DetailRow label="Symbol" value={KERNEL_SYMBOL} />
                <DetailRow label="Decimals" value={KERNEL_DECIMALS.toString()} />
                <DetailRow label="Standard" value="Token-2022" />
                <DetailRow label="Network" value={NETWORK === 'devnet' ? 'Solana (Devnet)' : 'Solana'} />
                <DetailRow label="Transfer Fee" value={`${TOTAL_FEE_BPS / 100}%`} />
              </div>
            </div>

            {/* Fee Distribution */}
            <div className="bg-[#16213E] rounded-xl p-6 border border-[#FFD700]/20">
              <h3 className="text-xl font-bold text-[#FFD700] mb-4">Fee Distribution</h3>
              <div className="space-y-4">
                <FeeRow
                  icon="💰"
                  label="Reflections"
                  percentage={REFLECTION_FEE_BPS / 100}
                  description="To stakers"
                />
                <FeeRow
                  icon="🌊"
                  label="Liquidity"
                  percentage={LP_FEE_BPS / 100}
                  description="Auto-LP"
                />
                <FeeRow
                  icon="🔥"
                  label="Burn"
                  percentage={BURN_FEE_BPS / 100}
                  description="Deflation"
                />
                <div className="border-t border-[#FFD700]/20 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">Total Fee</span>
                    <span className="font-bold text-[#FFD700]">{TOTAL_FEE_BPS / 100}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reflection Stats */}
          <div className="bg-[#16213E] rounded-xl p-6 mb-8 border border-[#FFD700]/20">
            <h3 className="text-xl font-bold text-[#FFD700] mb-4">Reflection Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-gray-400 text-sm">Total Distributed</p>
                {isLoading ? (
                  <SkeletonBox className="w-32 h-8 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-white">
                    {formatNumber(totalReflectionsDistributed)} {KERNEL_SYMBOL}
                  </p>
                )}
              </div>
              <div>
                <p className="text-gray-400 text-sm">Reflection Rate</p>
                <p className="text-2xl font-bold text-[#FFD700]">2% per transfer</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Est. APY</p>
                {isLoading ? (
                  <SkeletonBox className="w-20 h-8 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-green-400">
                    {estimatedAPY > 0 ? `${estimatedAPY.toFixed(0)}%` : '—'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <a
              href={getExplorerUrl(KERNEL_MINT.toString())}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#16213E] rounded-xl p-4 border border-[#FFD700]/20 flex items-center justify-between hover:border-[#FFD700]/50 transition-colors"
            >
              <span className="text-white font-medium">View on Solscan</span>
              <span className="text-gray-400">→</span>
            </a>
            <a
              href={`https://jup.ag/swap/SOL-${KERNEL_MINT.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#16213E] rounded-xl p-4 border border-[#FFD700]/20 flex items-center justify-between hover:border-[#FFD700]/50 transition-colors"
            >
              <span className="text-white font-medium">Trade on Jupiter</span>
              <span className="text-gray-400">→</span>
            </a>
          </div>

          {/* Colonel Kernel Quote */}
          <div className="bg-gradient-to-r from-[#FFD700]/10 to-[#FF6B35]/10 rounded-xl p-6 border border-[#FFD700]/20 text-center">
            <div className="text-4xl mb-4">🍿</div>
            <p className="text-xl text-[#FFD700] font-semibold mb-2">
              &quot;Every transfer pops more kernels into staker wallets!&quot;
            </p>
            <p className="text-gray-400">- Colonel Kernel</p>
          </div>
        </div>
      </main>
    </>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
  color,
  loading = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div className={`bg-[#16213E] rounded-xl p-4 border ${highlight ? 'border-[#FFD700]/40' : 'border-[#FFD700]/20'}`}>
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      {loading ? (
        <SkeletonBox className="w-24 h-8 mt-1" />
      ) : (
        <p className="text-2xl font-bold" style={{ color: color || (highlight ? '#FFD700' : 'white') }}>
          {value}
        </p>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function FeeRow({
  icon,
  label,
  percentage,
  description,
}: {
  icon: string;
  label: string;
  percentage: number;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-white font-medium">{label}</p>
          <p className="text-gray-500 text-sm">{description}</p>
        </div>
      </div>
      <span className="text-[#FFD700] font-bold">{percentage}%</span>
    </div>
  );
}
