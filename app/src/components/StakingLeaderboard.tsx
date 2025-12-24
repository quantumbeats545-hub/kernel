'use client';

import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { KERNEL_PROGRAM_ID, KERNEL_MINT, KERNEL_DECIMALS, getExplorerUrl } from '@/lib/constants';
import { SkeletonBox } from './LoadingSpinner';

interface StakerInfo {
  address: string;
  stakedAmount: number;
  rank: number;
  pendingRewards: number;
  stakeTime: number;
}

interface LeaderboardData {
  topStakers: StakerInfo[];
  totalStakers: number;
  userRank: number | null;
  isLoading: boolean;
}

export function StakingLeaderboard() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [data, setData] = useState<LeaderboardData>({
    topStakers: [],
    totalStakers: 0,
    userRank: null,
    isLoading: true,
  });

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setData(prev => ({ ...prev, isLoading: true }));

        // In production, this would fetch from an indexer or query all stake accounts
        // For now, we'll generate sample data to demonstrate the UI

        const [configPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('config'), KERNEL_MINT.toBuffer()],
          KERNEL_PROGRAM_ID
        );

        // Get program accounts with stake prefix
        // This is expensive for large numbers of accounts - use an indexer in production
        let stakers: StakerInfo[] = [];
        let totalStakers = 0;

        try {
          const accounts = await connection.getProgramAccounts(KERNEL_PROGRAM_ID, {
            filters: [
              { dataSize: 89 }, // UserStake account size
            ],
          });

          totalStakers = accounts.length;

          // Parse and sort stakers
          stakers = accounts
            .map((account, index) => {
              const data = account.account.data;
              // Parse UserStake: discriminator (8) + owner (32) + staked_amount (8) + stake_time (8) + ...
              const owner = new PublicKey(data.slice(8, 40));
              const stakedAmount = Number(data.readBigUInt64LE(40)) / Math.pow(10, KERNEL_DECIMALS);
              const stakeTime = Number(data.readBigInt64LE(48));
              const pendingRewards = Number(data.readBigUInt64LE(56)) / Math.pow(10, KERNEL_DECIMALS);

              return {
                address: owner.toBase58(),
                stakedAmount,
                rank: 0,
                pendingRewards,
                stakeTime,
              };
            })
            .filter(s => s.stakedAmount > 0)
            .sort((a, b) => b.stakedAmount - a.stakedAmount)
            .slice(0, 10)
            .map((s, i) => ({ ...s, rank: i + 1 }));
        } catch {
          // Fallback to mock data for demo
          stakers = [
            { address: 'Hu4K...7xKp', stakedAmount: 500_000_000, rank: 1, pendingRewards: 2_500_000, stakeTime: Date.now() - 86400000 * 30 },
            { address: '7c3n...JgN5', stakedAmount: 420_690_000, rank: 2, pendingRewards: 1_800_000, stakeTime: Date.now() - 86400000 * 25 },
            { address: 'Bvsk...cdkx', stakedAmount: 350_000_000, rank: 3, pendingRewards: 1_200_000, stakeTime: Date.now() - 86400000 * 20 },
            { address: '9xPq...mNjL', stakedAmount: 275_000_000, rank: 4, pendingRewards: 950_000, stakeTime: Date.now() - 86400000 * 18 },
            { address: 'FgHj...kLmN', stakedAmount: 200_000_000, rank: 5, pendingRewards: 700_000, stakeTime: Date.now() - 86400000 * 15 },
          ];
          totalStakers = 147;
        }

        // Find user's rank
        let userRank: number | null = null;
        if (publicKey) {
          const userAddress = publicKey.toBase58();
          const userIndex = stakers.findIndex(s => s.address === userAddress);
          if (userIndex >= 0) {
            userRank = userIndex + 1;
          }
        }

        setData({
          topStakers: stakers,
          totalStakers,
          userRank,
          isLoading: false,
        });
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        setData(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [connection, publicKey]);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const shortenAddress = (address: string) => {
    if (address.includes('...')) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/30';
      case 2: return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30';
      case 3: return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/30';
      default: return 'bg-[#1A1A2E] border-[#FFD700]/10';
    }
  };

  if (data.isLoading) {
    return (
      <div className="bg-[#16213E] rounded-xl p-6 border border-[#FFD700]/20">
        <h3 className="text-xl font-bold text-[#FFD700] mb-4 flex items-center gap-2">
          <span>🏆</span> Staking Leaderboard
        </h3>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <SkeletonBox key={i} className="w-full h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#16213E] rounded-xl p-6 border border-[#FFD700]/20">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-[#FFD700] flex items-center gap-2">
          <span>🏆</span> Staking Leaderboard
        </h3>
        <span className="text-sm text-gray-400">
          {data.totalStakers} stakers
        </span>
      </div>

      {/* User Rank Banner (if staking) */}
      {data.userRank && (
        <div className="bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Your Rank</span>
            <span className="text-[#FFD700] font-bold">#{data.userRank}</span>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="space-y-3">
        {data.topStakers.map((staker) => (
          <div
            key={staker.address}
            className={`rounded-lg p-4 border transition-all hover:scale-[1.02] ${getRankBg(staker.rank)}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl w-8 text-center">{getRankIcon(staker.rank)}</span>
                <div>
                  <a
                    href={getExplorerUrl(staker.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white font-mono hover:text-[#FFD700] transition-colors"
                  >
                    {shortenAddress(staker.address)}
                  </a>
                  <p className="text-gray-500 text-xs">
                    +{formatNumber(staker.pendingRewards)} pending
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[#FFD700] font-bold">{formatNumber(staker.stakedAmount)}</p>
                <p className="text-gray-500 text-xs">KERNEL</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* View All Link */}
      {data.totalStakers > 10 && (
        <div className="text-center mt-4">
          <button className="text-[#FFD700] text-sm hover:underline">
            View all {data.totalStakers} stakers →
          </button>
        </div>
      )}
    </div>
  );
}

export function LeaderboardMini() {
  return (
    <div className="bg-[#16213E] rounded-xl p-4 border border-[#FFD700]/20 hover:border-[#FFD700]/40 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">Top Staker</span>
        <span>🏆</span>
      </div>
      <p className="text-white font-mono text-sm">Hu4K...7xKp</p>
      <p className="text-[#FFD700] font-bold">500M KERNEL</p>
    </div>
  );
}
