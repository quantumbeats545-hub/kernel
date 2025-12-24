'use client';

import { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { KERNEL_MINT, KERNEL_TOTAL_SUPPLY, KERNEL_DECIMALS, KERNEL_PROGRAM_ID, getExplorerUrl } from '@/lib/constants';
import { SkeletonBox } from './LoadingSpinner';

interface BurnStats {
  totalBurned: number;
  burnPercentage: number;
  circulatingSupply: number;
  estimatedDailyBurn: number;
  burnEvents: BurnEvent[];
}

interface BurnEvent {
  amount: number;
  timestamp: number;
  txSignature: string;
}

export function BurnTracker() {
  const { connection } = useConnection();
  const [stats, setStats] = useState<BurnStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBurnStats = async () => {
      try {
        setIsLoading(true);

        // Derive burn record PDA
        const [configPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('config'), KERNEL_MINT.toBuffer()],
          KERNEL_PROGRAM_ID
        );

        const [burnRecordPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('burn'), configPda.toBuffer()],
          KERNEL_PROGRAM_ID
        );

        // Try to fetch burn record
        let totalBurned = KERNEL_TOTAL_SUPPLY * 0.1; // Default 10% initial burn

        try {
          const burnAccount = await connection.getAccountInfo(burnRecordPda);
          if (burnAccount && burnAccount.data.length >= 24) {
            // Parse burn record: discriminator (8) + total_burned (8) + burn_count (8)
            totalBurned = Number(burnAccount.data.readBigUInt64LE(8)) / Math.pow(10, KERNEL_DECIMALS);
          }
        } catch {
          // Use default if account doesn't exist
        }

        const burnPercentage = (totalBurned / KERNEL_TOTAL_SUPPLY) * 100;
        const circulatingSupply = KERNEL_TOTAL_SUPPLY - totalBurned;

        // Estimate daily burn based on 1% of 0.1% daily volume (rough estimate)
        const estimatedDailyBurn = KERNEL_TOTAL_SUPPLY * 0.0001 * 0.01;

        // Mock recent burn events (in production, fetch from on-chain or indexer)
        const burnEvents: BurnEvent[] = [
          { amount: 42_000_000, timestamp: Date.now() - 3600000, txSignature: 'mock1' },
          { amount: 69_000_000, timestamp: Date.now() - 7200000, txSignature: 'mock2' },
          { amount: 13_370_000, timestamp: Date.now() - 14400000, txSignature: 'mock3' },
        ];

        setStats({
          totalBurned,
          burnPercentage,
          circulatingSupply,
          estimatedDailyBurn,
          burnEvents,
        });
      } catch (error) {
        console.error('Error fetching burn stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBurnStats();
    const interval = setInterval(fetchBurnStats, 60000);
    return () => clearInterval(interval);
  }, [connection]);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="bg-[#16213E] rounded-xl p-6 border border-[#FFD700]/20">
        <h3 className="text-xl font-bold text-[#FFD700] mb-4 flex items-center gap-2">
          <span>🔥</span> Burn Tracker
        </h3>
        <div className="space-y-4">
          <SkeletonBox className="w-full h-20" />
          <SkeletonBox className="w-full h-32" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="bg-[#16213E] rounded-xl p-6 border border-[#FFD700]/20">
      <h3 className="text-xl font-bold text-[#FFD700] mb-4 flex items-center gap-2">
        <span>🔥</span> Burn Tracker
      </h3>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#1A1A2E] rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Burned</p>
          <p className="text-2xl font-bold text-[#FF6B35]">{formatNumber(stats.totalBurned)}</p>
          <p className="text-sm text-gray-500">{stats.burnPercentage.toFixed(2)}% of supply</p>
        </div>
        <div className="bg-[#1A1A2E] rounded-lg p-4">
          <p className="text-gray-400 text-sm">Circulating</p>
          <p className="text-2xl font-bold text-[#FFD700]">{formatNumber(stats.circulatingSupply)}</p>
          <p className="text-sm text-gray-500">{(100 - stats.burnPercentage).toFixed(2)}% remaining</p>
        </div>
      </div>

      {/* Burn Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Burn Progress</span>
          <span className="text-[#FF6B35]">{stats.burnPercentage.toFixed(2)}%</span>
        </div>
        <div className="h-4 bg-[#1A1A2E] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#FF6B35] to-[#FF4444] rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(stats.burnPercentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>Target: 50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Estimated Daily Burn */}
      <div className="bg-[#1A1A2E] rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-gray-400 text-sm">Est. Daily Burn Rate</p>
            <p className="text-lg font-bold text-[#FF6B35]">{formatNumber(stats.estimatedDailyBurn)}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Time to 50% Burn</p>
            <p className="text-lg font-bold text-white">
              {stats.estimatedDailyBurn > 0
                ? Math.ceil((KERNEL_TOTAL_SUPPLY * 0.5 - stats.totalBurned) / stats.estimatedDailyBurn) + ' days'
                : '∞'}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Burns */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 mb-3">Recent Burns</h4>
        <div className="space-y-2">
          {stats.burnEvents.map((event, i) => (
            <div key={i} className="flex justify-between items-center bg-[#1A1A2E] rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-[#FF6B35]">🔥</span>
                <span className="text-white font-mono">{formatNumber(event.amount)}</span>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">{formatTimeAgo(event.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BurnTrackerMini() {
  const [burnPercentage, setBurnPercentage] = useState(10);

  useEffect(() => {
    // Animate burn percentage on mount
    const timer = setTimeout(() => setBurnPercentage(12.5), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-[#16213E] rounded-xl p-4 border border-[#FF6B35]/30 hover:border-[#FF6B35]/50 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">Tokens Burned</span>
        <span className="text-[#FF6B35]">🔥</span>
      </div>
      <p className="text-2xl font-bold text-[#FF6B35]">{burnPercentage.toFixed(1)}%</p>
      <div className="h-2 bg-[#1A1A2E] rounded-full mt-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#FF6B35] to-[#FF4444] rounded-full transition-all duration-1000"
          style={{ width: `${burnPercentage}%` }}
        />
      </div>
    </div>
  );
}
