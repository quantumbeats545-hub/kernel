'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { SkeletonBox } from '@/components/LoadingSpinner';
import { KERNEL_TOTAL_SUPPLY, TOTAL_FEE_BPS, REFLECTION_FEE_BPS, LP_FEE_BPS, BURN_FEE_BPS, NETWORK } from '@/lib/constants';
import { useTokenData } from '@/hooks/useTokenData';

export default function Home() {
  const { totalBurned, isLoading } = useTokenData();
  const burnPercentage = (totalBurned / KERNEL_TOTAL_SUPPLY) * 100;

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    return num.toLocaleString();
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#1A1A2E]" />

          <div className="relative max-w-7xl mx-auto text-center">
            {/* Network Badge */}
            {NETWORK === 'devnet' && (
              <span className="inline-block mb-4 px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full">
                Devnet
              </span>
            )}

            {/* Mascot */}
            <div className="text-8xl mb-6 animate-bounce">
              🍿
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-4">
              <span className="text-[#FFD700]">$KERNEL</span>
            </h1>

            <p className="text-2xl md:text-3xl text-gray-300 mb-2">
              The Core of Crypto Security!
            </p>

            <p className="text-lg text-[#FF6B35] font-semibold mb-8">
              Colonel Kernel reporting for duty!
            </p>

            <p className="max-w-2xl mx-auto text-gray-400 mb-10">
              Join the kernel army and earn reflections just by staking! Every transfer feeds the stakers,
              grows the liquidity, and burns supply. No kernel panics here - just pamps!
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                href="/stake"
                className="px-8 py-4 bg-[#FFD700] text-[#1A1A2E] font-bold rounded-lg hover:bg-[#FFC000] transition-colors text-lg"
              >
                Stake $KERNEL
              </Link>
              <Link
                href="/token"
                className="px-8 py-4 bg-transparent border-2 border-[#FFD700] text-[#FFD700] font-bold rounded-lg hover:bg-[#FFD700]/10 transition-colors text-lg"
              >
                View Tokenomics
              </Link>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <div className="bg-[#16213E] rounded-xl p-4 border border-[#FFD700]/20">
                <p className="text-gray-400 text-sm">Total Supply</p>
                <p className="text-2xl font-bold text-[#FFD700]">{formatNumber(KERNEL_TOTAL_SUPPLY)}</p>
              </div>
              <div className="bg-[#16213E] rounded-xl p-4 border border-[#FFD700]/20">
                <p className="text-gray-400 text-sm">Transfer Fee</p>
                <p className="text-2xl font-bold text-[#FFD700]">{TOTAL_FEE_BPS / 100}%</p>
              </div>
              <div className="bg-[#16213E] rounded-xl p-4 border border-[#FFD700]/20">
                <p className="text-gray-400 text-sm">Burned</p>
                {isLoading ? (
                  <SkeletonBox className="w-16 h-8 mt-1 mx-auto" />
                ) : (
                  <p className="text-2xl font-bold text-[#FF6B35]">{burnPercentage.toFixed(1)}%</p>
                )}
              </div>
              <div className="bg-[#16213E] rounded-xl p-4 border border-[#FFD700]/20">
                <p className="text-gray-400 text-sm">Network</p>
                <p className="text-2xl font-bold text-white">Solana</p>
              </div>
            </div>
          </div>
        </section>

        {/* Fee Breakdown Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#16213E]/50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              <span className="text-[#FFD700]">5%</span> Transfer Fee Distribution
            </h2>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="bg-[#1A1A2E] rounded-xl p-6 border border-[#FFD700]/20 text-center hover:border-[#FFD700]/50 transition-colors">
                <div className="text-4xl mb-4">💰</div>
                <h3 className="text-xl font-bold text-[#FFD700] mb-2">{REFLECTION_FEE_BPS / 100}% Reflections</h3>
                <p className="text-gray-400">
                  Distributed to all stakers proportionally. Stake more, earn more!
                </p>
              </div>

              <div className="bg-[#1A1A2E] rounded-xl p-6 border border-[#FFD700]/20 text-center hover:border-[#FFD700]/50 transition-colors">
                <div className="text-4xl mb-4">🌊</div>
                <h3 className="text-xl font-bold text-[#FFD700] mb-2">{LP_FEE_BPS / 100}% Liquidity</h3>
                <p className="text-gray-400">
                  Added to the liquidity pool to strengthen the floor.
                </p>
              </div>

              <div className="bg-[#1A1A2E] rounded-xl p-6 border border-[#FFD700]/20 text-center hover:border-[#FFD700]/50 transition-colors">
                <div className="text-4xl mb-4">🔥</div>
                <h3 className="text-xl font-bold text-[#FFD700] mb-2">{BURN_FEE_BPS / 100}% Burn</h3>
                <p className="text-gray-400">
                  Permanently removed from supply. Deflation = value!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Distribution Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Token <span className="text-[#FFD700]">Distribution</span>
            </h2>

            <div className="max-w-2xl mx-auto space-y-4">
              <DistributionBar label="Liquidity Pool" percentage={50} color="#FFD700" />
              <DistributionBar label="Airdrops & Rewards" percentage={20} color="#FF6B35" />
              <DistributionBar label="Marketing & Dev" percentage={15} color="#8B4513" />
              <DistributionBar label="Initial Burn" percentage={10} color="#FF4444" />
              <DistributionBar label="Team (Vested)" percentage={5} color="#A0A0A0" />
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#16213E]/30">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              How <span className="text-[#FFD700]">$KERNEL</span> Works
            </h2>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#FFD700] rounded-full flex items-center justify-center text-2xl font-bold text-[#1A1A2E] mx-auto mb-4">1</div>
                <h3 className="text-xl font-bold text-white mb-2">Buy $KERNEL</h3>
                <p className="text-gray-400">Get KERNEL tokens on Jupiter or your favorite DEX</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#FFD700] rounded-full flex items-center justify-center text-2xl font-bold text-[#1A1A2E] mx-auto mb-4">2</div>
                <h3 className="text-xl font-bold text-white mb-2">Stake Tokens</h3>
                <p className="text-gray-400">Connect your wallet and stake to earn reflections</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#FFD700] rounded-full flex items-center justify-center text-2xl font-bold text-[#1A1A2E] mx-auto mb-4">3</div>
                <h3 className="text-xl font-bold text-white mb-2">Earn Rewards</h3>
                <p className="text-gray-400">Claim your share of the 2% reflection fee anytime</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 border-t border-[#FFD700]/20">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-gray-400 mb-2">
              🍿 Colonel Kernel says: &quot;Stay popped, stay stacked!&quot;
            </p>
            <p className="text-sm text-gray-500">
              $KERNEL - The Core of Crypto Security {NETWORK === 'devnet' && '| Devnet'}
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}

function DistributionBar({ label, percentage, color }: { label: string; percentage: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-[#FFD700] font-bold">{percentage}%</span>
      </div>
      <div className="h-4 bg-[#16213E] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
