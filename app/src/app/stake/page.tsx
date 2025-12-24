'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Navbar from '@/components/Navbar';
import LoadingSpinner, { SkeletonBox } from '@/components/LoadingSpinner';
import { KERNEL_SYMBOL, NETWORK, getExplorerUrl } from '@/lib/constants';
import { useUserBalance } from '@/hooks/useTokenData';
import { useStakingData, useGlobalStakingData, calculateEstimatedAPY } from '@/hooks/useStaking';
import { useStakingActions } from '@/hooks/useStakingActions';
import { BurnTracker } from '@/components/BurnTracker';
import { FeeDashboard } from '@/components/FeeDashboard';
import { StakingLeaderboard } from '@/components/StakingLeaderboard';

export default function StakePage() {
  const { publicKey, connected } = useWallet();
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');
  const [amount, setAmount] = useState('');
  const [txStatus, setTxStatus] = useState<{ type: 'success' | 'error'; message: string; txSig?: string } | null>(null);

  // Real data hooks
  const { balance: walletBalance, isLoading: balanceLoading, refetch: refetchBalance } = useUserBalance();
  const { stakedAmount, pendingRewards, totalClaimed, isLoading: stakingLoading, refetch: refetchStaking } = useStakingData();
  const { totalStaked, isPaused, isLoading: globalLoading, refetch: refetchGlobal } = useGlobalStakingData();

  // Real transaction hooks
  const { stake, unstake, claimReflections, isProcessing, error: actionError } = useStakingActions();
  const loading = isProcessing;

  const estimatedAPY = calculateEstimatedAPY(totalStaked);
  const isDataLoading = balanceLoading || stakingLoading || globalLoading;

  // Refetch all data after a transaction
  const refetchAll = async () => {
    await Promise.all([refetchBalance(), refetchStaking(), refetchGlobal()]);
  };

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const handleStake = async () => {
    if (!connected || !amount || !publicKey) return;
    setTxStatus(null);

    try {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        setTxStatus({ type: 'error', message: 'Please enter a valid amount' });
        return;
      }

      const txSig = await stake(amountNum);
      setTxStatus({
        type: 'success',
        message: `Successfully staked ${amount} ${KERNEL_SYMBOL}!`,
        txSig,
      });
      setAmount('');
      await refetchAll();
    } catch (error) {
      console.error('Stake error:', error);
      const message = error instanceof Error ? error.message : 'Failed to stake. Please try again.';
      setTxStatus({ type: 'error', message });
    }
  };

  const handleUnstake = async () => {
    if (!connected || !amount || !publicKey) return;
    setTxStatus(null);

    try {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        setTxStatus({ type: 'error', message: 'Please enter a valid amount' });
        return;
      }

      const txSig = await unstake(amountNum);
      setTxStatus({
        type: 'success',
        message: `Successfully unstaked ${amount} ${KERNEL_SYMBOL}!`,
        txSig,
      });
      setAmount('');
      await refetchAll();
    } catch (error) {
      console.error('Unstake error:', error);
      const message = error instanceof Error ? error.message : 'Failed to unstake. Please try again.';
      setTxStatus({ type: 'error', message });
    }
  };

  const handleClaim = async () => {
    if (!connected || !publicKey) return;
    setTxStatus(null);

    try {
      const txSig = await claimReflections();
      setTxStatus({
        type: 'success',
        message: `Successfully claimed ${formatNumber(pendingRewards)} ${KERNEL_SYMBOL}!`,
        txSig,
      });
      await refetchAll();
    } catch (error) {
      console.error('Claim error:', error);
      const message = error instanceof Error ? error.message : 'Failed to claim. Please try again.';
      setTxStatus({ type: 'error', message });
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              <span className="text-[#FFD700]">Stake</span> $KERNEL
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto">
              Stake your KERNEL tokens to earn reflection rewards from every transfer.
              The more you stake, the bigger your share of the 2% reflection fee!
            </p>
            {NETWORK === 'devnet' && (
              <span className="inline-block mt-4 px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full">
                Devnet
              </span>
            )}
          </div>

          {/* Paused Warning */}
          {isPaused && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-center">
              <p className="text-red-400 font-semibold">Staking is currently paused</p>
            </div>
          )}

          {/* Transaction Status */}
          {txStatus && (
            <div className={`mb-6 p-4 rounded-xl text-center ${
              txStatus.type === 'success'
                ? 'bg-green-500/20 border border-green-500/50'
                : 'bg-red-500/20 border border-red-500/50'
            }`}>
              <p className={txStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}>
                {txStatus.message}
              </p>
              {txStatus.txSig && (
                <a
                  href={getExplorerUrl(txStatus.txSig, 'tx')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#FFD700] hover:underline mt-2 inline-block"
                >
                  View Transaction
                </a>
              )}
            </div>
          )}

          {!connected ? (
            // Not connected state
            <div className="bg-[#16213E] rounded-2xl p-12 border border-[#FFD700]/20 text-center">
              <div className="text-6xl mb-6">🍿</div>
              <h2 className="text-2xl font-bold text-[#FFD700] mb-4">
                Connect Your Wallet
              </h2>
              <p className="text-gray-400 mb-6">
                Connect your wallet to start staking and earning reflections!
              </p>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard
                  label="Your Balance"
                  value={isDataLoading ? null : formatNumber(walletBalance)}
                  suffix={KERNEL_SYMBOL}
                  loading={isDataLoading}
                />
                <StatCard
                  label="Staked"
                  value={isDataLoading ? null : formatNumber(stakedAmount)}
                  suffix={KERNEL_SYMBOL}
                  highlight
                  loading={isDataLoading}
                />
                <StatCard
                  label="Pending Rewards"
                  value={isDataLoading ? null : formatNumber(pendingRewards)}
                  suffix={KERNEL_SYMBOL}
                  highlight
                  loading={isDataLoading}
                />
                <StatCard
                  label="Est. APY"
                  value={isDataLoading ? null : (estimatedAPY > 0 ? estimatedAPY.toFixed(1) : '—')}
                  suffix={estimatedAPY > 0 ? '%' : ''}
                  loading={isDataLoading}
                />
              </div>

              {/* Staking Card */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* Stake/Unstake */}
                <div className="bg-[#16213E] rounded-2xl p-6 border border-[#FFD700]/20">
                  {/* Tabs */}
                  <div className="flex gap-2 mb-6">
                    <button
                      onClick={() => { setActiveTab('stake'); setAmount(''); }}
                      className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                        activeTab === 'stake'
                          ? 'bg-[#FFD700] text-[#1A1A2E]'
                          : 'bg-[#1A1A2E] text-gray-400 hover:text-white'
                      }`}
                    >
                      Stake
                    </button>
                    <button
                      onClick={() => { setActiveTab('unstake'); setAmount(''); }}
                      className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                        activeTab === 'unstake'
                          ? 'bg-[#FFD700] text-[#1A1A2E]'
                          : 'bg-[#1A1A2E] text-gray-400 hover:text-white'
                      }`}
                    >
                      Unstake
                    </button>
                  </div>

                  {/* Amount Input */}
                  <div className="mb-4">
                    <div className="flex justify-between mb-2">
                      <label className="text-gray-400 text-sm">Amount</label>
                      <span className="text-gray-400 text-sm">
                        Available: {isDataLoading ? '...' : formatNumber(activeTab === 'stake' ? walletBalance : stakedAmount)}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="any"
                        className="w-full bg-[#1A1A2E] border border-[#FFD700]/20 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-[#FFD700] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => setAmount(
                          (activeTab === 'stake' ? walletBalance : stakedAmount).toString()
                        )}
                        disabled={isDataLoading}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FFD700] text-sm font-semibold hover:text-[#FFC000] disabled:opacity-50"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={activeTab === 'stake' ? handleStake : handleUnstake}
                    disabled={loading || !amount || parseFloat(amount) <= 0 || isPaused}
                    className="w-full py-4 bg-[#FFD700] text-[#1A1A2E] font-bold rounded-lg hover:bg-[#FFC000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading && <LoadingSpinner size="sm" />}
                    {loading ? 'Processing...' : activeTab === 'stake' ? 'Stake KERNEL' : 'Unstake KERNEL'}
                  </button>
                </div>

                {/* Claim Rewards */}
                <div className="bg-[#16213E] rounded-2xl p-6 border border-[#FFD700]/20">
                  <h3 className="text-xl font-bold text-[#FFD700] mb-6">Claim Rewards</h3>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Pending Rewards</span>
                      {isDataLoading ? (
                        <SkeletonBox className="w-24 h-8" />
                      ) : (
                        <span className="text-2xl font-bold text-[#FFD700]">
                          {formatNumber(pendingRewards)} {KERNEL_SYMBOL}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Claimed</span>
                      {isDataLoading ? (
                        <SkeletonBox className="w-20 h-6" />
                      ) : (
                        <span className="text-lg text-gray-300">
                          {formatNumber(totalClaimed)} {KERNEL_SYMBOL}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Total Pool Staked</span>
                      {isDataLoading ? (
                        <SkeletonBox className="w-20 h-6" />
                      ) : (
                        <span className="text-lg text-gray-300">
                          {formatNumber(totalStaked)} {KERNEL_SYMBOL}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleClaim}
                    disabled={loading || pendingRewards === 0 || isPaused}
                    className="w-full py-4 bg-[#FF6B35] text-white font-bold rounded-lg hover:bg-[#FF5722] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading && <LoadingSpinner size="sm" />}
                    {loading ? 'Processing...' : 'Claim Rewards'}
                  </button>

                  <p className="text-center text-gray-500 text-sm mt-4">
                    Rewards accrue continuously from the 2% reflection fee
                  </p>
                </div>
              </div>

              {/* Info Banner */}
              <div className="mt-8 bg-[#16213E]/50 rounded-xl p-6 border border-[#FFD700]/10">
                <h4 className="text-[#FFD700] font-semibold mb-2">How Staking Works</h4>
                <ul className="text-gray-400 text-sm space-y-2">
                  <li>• 2% of every $KERNEL transfer is distributed to stakers</li>
                  <li>• Your share is proportional to your stake in the total pool</li>
                  <li>• Rewards accumulate automatically - claim anytime</li>
                  <li>• No lockup period - unstake whenever you want</li>
                </ul>
              </div>

              {/* Dashboard Grid */}
              <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StakingLeaderboard />
                <BurnTracker />
                <FeeDashboard />
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function StatCard({
  label,
  value,
  suffix,
  highlight = false,
  loading = false,
}: {
  label: string;
  value: string | null;
  suffix?: string;
  highlight?: boolean;
  loading?: boolean;
}) {
  return (
    <div className={`bg-[#16213E] rounded-xl p-4 border ${highlight ? 'border-[#FFD700]/40' : 'border-[#FFD700]/20'}`}>
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      {loading ? (
        <SkeletonBox className="w-20 h-7 mt-1" />
      ) : (
        <p className={`text-xl font-bold ${highlight ? 'text-[#FFD700]' : 'text-white'}`}>
          {value} <span className="text-sm font-normal text-gray-400">{suffix}</span>
        </p>
      )}
    </div>
  );
}
