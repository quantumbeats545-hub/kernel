import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://kernel.freedomlabs.io'),
  title: {
    default: "$KERNEL - The Core of Crypto Security",
    template: "%s | $KERNEL",
  },
  description: "Colonel Kernel's meme coin on Solana. Stake KERNEL tokens to earn reflections from every transfer. 5% fee: 2% reflections, 2% LP, 1% burn.",
  keywords: ["KERNEL", "meme coin", "Solana", "staking", "reflections", "DeFi", "crypto"],
  authors: [{ name: "Colonel Kernel" }],
  creator: "Freedom Labs",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "$KERNEL",
    title: "$KERNEL - The Core of Crypto Security",
    description: "Join the kernel army! Stake KERNEL to earn reflections from every transfer.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "$KERNEL - Colonel Kernel",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "$KERNEL - The Core of Crypto Security",
    description: "Join the kernel army! Stake KERNEL to earn reflections from every transfer.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1A2E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#1A1A2E] text-white min-h-screen`}
      >
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
