'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="animate-spin rounded-full border-2 border-[#FFD700] border-t-transparent h-full w-full" />
    </div>
  );
}

export function LoadingCard({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="bg-[#16213E] rounded-xl p-8 border border-[#FFD700]/20 flex flex-col items-center justify-center">
      <LoadingSpinner size="lg" />
      <p className="text-gray-400 mt-4">{message}</p>
    </div>
  );
}

export function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-[#16213E] rounded ${className}`} />
  );
}

// Default export for backwards compatibility
export default LoadingSpinner;
