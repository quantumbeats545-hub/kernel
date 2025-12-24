'use client';

import { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { KERNEL_MINT, KERNEL_PROGRAM_ID, KERNEL_DECIMALS, REFLECTION_FEE_BPS, LP_FEE_BPS, BURN_FEE_BPS } from '@/lib/constants';
import { SkeletonBox } from './LoadingSpinner';

interface FeeStats {
  totalFeesCollected: number;
  totalReflectionsDistributed: number;
  totalLPAdded: number;
  totalBurnedFromFees: number;
  pendingFees: number;
  lastHarvestTime: number | null;
}

export function FeeDashboard() {
  const { connection } = useConnection();
  const [stats, setStats] = useState<FeeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeeStats = async () => {
      try {
        setIsLoading(true);

        // Derive config PDA
        const [configPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('config'), KERNEL_MINT.toBuffer()],
          KERNEL_PROGRAM_ID
        );

        let totalReflectionsDistributed = 0;
        let pendingReflections = 0;

        try {
          const configAccount = await connection.getAccountInfo(configPda);
          if (configAccount && configAccount.data.length >= 168) {
            // Parse config: skip to offset for staking data
            // Layout: discriminator (8) + authority (32) + token_mint (32) + staking_vault (32) + reflection_pool (32) +
            //         reflection_share_bps (2) + lp_share_bps (2) + burn_share_bps (2) +
            //         total_staked (8) + total_reflections_distributed (8) + pending_reflections (8)
            const offset = 8 + 32 + 32 + 32 + 32 + 2 + 2 + 2;
            totalReflectionsDistributed = Number(configAccount.data.readBigUInt64LE(offset + 8)) / Math.pow(10, KERNEL_DECIMALS);
            pendingReflections = Number(configAccount.data.readBigUInt64LE(offset + 16)) / Math.pow(10, KERNEL_DECIMALS);
          }
        } catch {
          // Use defaults
        }

        // Calculate proportional stats based on fee distribution
        const reflectionRatio = REFLECTION_FEE_BPS / (REFLECTION_FEE_BPS + LP_FEE_BPS + BURN_FEE_BPS);
        const lpRatio = LP_FEE_BPS / (REFLECTION_FEE_BPS + LP_FEE_BPS + BURN_FEE_BPS);
        const burnRatio = BURN_FEE_BPS / (REFLECTION_FEE_BPS + LP_FEE_BPS + BURN_FEE_BPS);

        const totalFeesCollected = totalReflectionsDistributed / reflectionRatio || 0;

        setStats({
          totalFeesCollected,
          totalReflectionsDistributed,
          totalLPAdded: totalFeesCollected * lpRatio,
          totalBurnedFromFees: totalFeesCollected * burnRatio,
          pendingFees: pendingReflections,
          lastHarvestTime: null,
        });
      } catch (error) {
        console.error('Error fetching fee stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeeStats();
    const interval = setInterval(fetchFeeStats, 30000);
    return () => clearInterval(interval);
  }, [connection]);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="bg-[#16213E] rounded-xl p-6 border border-[#FFD700]/20">
        <h3 className="text-xl font-bold text-[#FFD700] mb-4 flex items-center gap-2">
          <span>💰</span> Fee Dashboard
        </h3>
        <div className="space-y-4">
          <SkeletonBox className="w-full h-24" />
          <SkeletonBox className="w-full h-32" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const distributions = [
    { label: 'Reflections', value: stats.totalReflectionsDistributed, percentage: 40, color: '#FFD700', icon: '💰' },
    { label: 'Liquidity', value: stats.totalLPAdded, percentage: 40, color: '#00BFFF', icon: '🌊' },
    { label: 'Burned', value: stats.totalBurnedFromFees, percentage: 20, color: '#FF6B35', icon: '🔥' },
  ];

  return (
    <div className="bg-[#16213E] rounded-xl p-6 border border-[#FFD700]/20">
      <h3 className="text-xl font-bold text-[#FFD700] mb-4 flex items-center gap-2">
        <span>💰</span> Fee Dashboard
      </h3>

      {/* Total Fees Card */}
      <div className="bg-gradient-to-r from-[#FFD700]/20 to-[#FF6B35]/20 rounded-lg p-4 mb-6">
        <p className="text-gray-400 text-sm">Total Fees Collected (All Time)</p>
        <p className="text-3xl font-bold text-[#FFD700]">{formatNumber(stats.totalFeesCollected)} KERNEL</p>
        {stats.pendingFees > 0 && (
          <p className="text-sm text-gray-400 mt-1">
            + {formatNumber(stats.pendingFees)} pending distribution
          </p>
        )}
      </div>

      {/* Distribution Breakdown */}
      <h4 className="text-sm font-semibold text-gray-400 mb-3">Fee Distribution</h4>
      <div className="space-y-4 mb-6">
        {distributions.map((dist, i) => (
          <div key={i}>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <span>{dist.icon}</span>
                <span className="text-gray-300">{dist.label}</span>
                <span className="text-gray-500 text-sm">({dist.percentage}%)</span>
              </div>
              <span className="text-white font-mono">{formatNumber(dist.value)}</span>
            </div>
            <div className="h-2 bg-[#1A1A2E] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${dist.percentage}%`,
                  backgroundColor: dist.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Pie Chart Visualization */}
      <div className="flex items-center justify-center">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 36 36" className="w-full h-full">
            {/* Background circle */}
            <circle cx="18" cy="18" r="16" fill="none" stroke="#1A1A2E" strokeWidth="3" />
            {/* Reflections - 40% */}
            <circle
              cx="18" cy="18" r="16"
              fill="none"
              stroke="#FFD700"
              strokeWidth="3"
              strokeDasharray="40 60"
              strokeDashoffset="25"
              className="transition-all duration-1000"
            />
            {/* LP - 40% */}
            <circle
              cx="18" cy="18" r="16"
              fill="none"
              stroke="#00BFFF"
              strokeWidth="3"
              strokeDasharray="40 60"
              strokeDashoffset="65"
              className="transition-all duration-1000"
            />
            {/* Burn - 20% */}
            <circle
              cx="18" cy="18" r="16"
              fill="none"
              stroke="#FF6B35"
              strokeWidth="3"
              strokeDasharray="20 80"
              strokeDashoffset="5"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">💰</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-4 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#FFD700]" />
          <span className="text-gray-400">Reflect</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#00BFFF]" />
          <span className="text-gray-400">LP</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#FF6B35]" />
          <span className="text-gray-400">Burn</span>
        </div>
      </div>
    </div>
  );
}
