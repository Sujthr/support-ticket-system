'use client';

import { branding } from '@/lib/branding';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  orgLogo?: string | null;
}

const sizeMap = {
  sm: { icon: 'w-7 h-7', text: 'text-sm', fontSize: '11' },
  md: { icon: 'w-9 h-9', text: 'text-lg', fontSize: '14' },
  lg: { icon: 'w-12 h-12', text: 'text-xl', fontSize: '18' },
  xl: { icon: 'w-16 h-16', text: 'text-2xl', fontSize: '24' },
};

export default function BrandLogo({ size = 'md', showText = true, className = '', orgLogo }: BrandLogoProps) {
  const s = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Logo / Icon */}
      {orgLogo || branding.logo ? (
        <img
          src={orgLogo || branding.logo!}
          alt={branding.appName}
          className={`${s.icon} rounded-lg object-contain`}
        />
      ) : (
        <svg
          className={`${s.icon} flex-shrink-0`}
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={`brand-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={branding.primaryColor} />
              <stop offset="100%" stopColor={branding.accentColor} />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill={`url(#brand-grad-${size})`} />
          <text
            x="32"
            y="42"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize={s.fontSize}
            fontWeight="700"
            fill={branding.iconTextColor}
            textAnchor="middle"
          >
            {branding.iconInitials}
          </text>
        </svg>
      )}

      {/* App Name */}
      {showText && (
        <div className="flex flex-col">
          <span className={`${s.text} font-bold leading-tight tracking-tight`}>
            {branding.appName}
          </span>
          {size !== 'sm' && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
              {branding.tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
