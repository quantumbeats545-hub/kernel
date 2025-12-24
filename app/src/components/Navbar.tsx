'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/token', label: 'Token' },
    { href: '/stake', label: 'Stake' },
    { href: '/airdrop', label: 'Airdrop', badge: '🎁' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#16213E]/90 backdrop-blur-sm border-b border-[#FFD700]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-3xl">🍿</span>
            <span className="text-xl font-bold text-[#FFD700]">$KERNEL</span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors flex items-center gap-1 ${
                  pathname === link.href
                    ? 'text-[#FFD700]'
                    : 'text-gray-300 hover:text-[#FFD700]'
                }`}
              >
                {link.label}
                {'badge' in link && <span>{link.badge}</span>}
              </Link>
            ))}
          </div>

          {/* Wallet Button */}
          <div className="flex items-center">
            <WalletMultiButton className="!bg-[#FFD700] !text-[#1A1A2E] !rounded-lg !font-semibold hover:!bg-[#FFC000] !transition-colors" />
          </div>
        </div>
      </div>
    </nav>
  );
}
