import React from 'react';

interface SegmentBadgeProps {
  segment: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const segmentColors: Record<string, { bg: string; text: string; border: string }> = {
  'VIP Champions': {
    bg: 'bg-gradient-to-r from-purple-50 to-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  'Loyal Spenders': {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  'At-Risk': {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  'Occasional Shoppers': {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  'New Customers': {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  default: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
  },
};

const segmentIcons: Record<string, string> = {
  'VIP Champions': 'Crown',
  'Loyal Spenders': 'Heart',
  'At-Risk': 'AlertTriangle',
  'Occasional Shoppers': 'ShoppingBag',
  'New Customers': 'Sparkles',
};

export function SegmentBadge({ segment, size = 'md', showIcon = true }: SegmentBadgeProps) {
  const colors = segmentColors[segment] || segmentColors.default;
  const iconName = segmentIcons[segment];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-sm gap-1.5',
    lg: 'px-3 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const renderIcon = () => {
    if (!showIcon) return null;

    const iconProps = { className: iconSizes[size] };

    switch (iconName) {
      case 'Crown':
        return (
          <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11m16-11v11M8 14v3m4-3v3m4-3v3" />
          </svg>
        );
      case 'Heart':
        return (
          <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        );
      case 'AlertTriangle':
        return (
          <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'ShoppingBag':
        return (
          <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        );
      case 'Sparkles':
        return (
          <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        );
      default:
        return (
          <svg {...iconProps} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
    }
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sizeClasses[size]} ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {renderIcon()}
      <span>{segment}</span>
    </span>
  );
}

interface SegmentCardProps {
  name: string;
  description: string;
  customerCount: number;
  avgLTV: number;
  avgEngagement: number;
  onClick?: () => void;
}

export function SegmentCard({
  name,
  description,
  customerCount,
  avgLTV,
  avgEngagement,
  onClick,
}: SegmentCardProps) {
  const colors = segmentColors[name] || segmentColors.default;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border ${colors.border} p-5 hover:shadow-md cursor-pointer transition-all`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className={`font-semibold ${colors.text}`}>{name}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}>
          {customerCount.toLocaleString()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
        <div>
          <p className="text-xs text-gray-500">Avg LTV</p>
          <p className="text-lg font-semibold text-gray-900">${avgLTV.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Avg Engagement</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-semibold text-gray-900">{avgEngagement}%</p>
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${colors.text.replace('text-', 'bg-')}`}
                style={{ width: `${avgEngagement}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
