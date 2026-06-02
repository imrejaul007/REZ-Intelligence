import React from 'react';
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';

interface PredictionBadgeProps {
  type: 'churn' | 'ltv';
  score: number;
  risk?: 'low' | 'medium' | 'high';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function PredictionBadge({
  type,
  score,
  risk = 'low',
  size = 'md',
  showIcon = true,
}: PredictionBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const getStyles = () => {
    if (type === 'churn') {
      if (score >= 70) {
        return {
          bg: 'bg-red-100',
          text: 'text-red-700',
          border: 'border-red-200',
          icon: TrendingDown,
          label: 'Critical',
        };
      }
      if (score >= 40) {
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-700',
          border: 'border-yellow-200',
          icon: AlertTriangle,
          label: 'Warning',
        };
      }
      return {
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-200',
        icon: TrendingUp,
        label: 'Healthy',
      };
    }

    // LTV type
    if (score >= 10000) {
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        border: 'border-purple-200',
        icon: TrendingUp,
        label: 'VIP',
      };
    }
    if (score >= 5000) {
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: TrendingUp,
        label: 'Premium',
      };
    }
    return {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      border: 'border-gray-200',
      icon: TrendingUp,
      label: 'Standard',
    };
  };

  const styles = getStyles();
  const Icon = styles.icon;

  const formatScore = () => {
    if (type === 'churn') {
      return `${score}%`;
    }
    return `$${score.toLocaleString()}`;
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClasses[size]} ${styles.bg} ${styles.text} ${styles.border}`}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{formatScore()}</span>
      <span className="opacity-75">-</span>
      <span>{styles.label}</span>
    </div>
  );
}

interface ChurnMeterProps {
  probability: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ChurnMeter({ probability, size = 'md' }: ChurnMeterProps) {
  const sizeConfig = {
    sm: { height: 'h-1.5', label: 'text-xs' },
    md: { height: 'h-2', label: 'text-sm' },
    lg: { height: 'h-3', label: 'text-base' },
  };

  const config = sizeConfig[size];

  const getColor = () => {
    if (probability >= 70) return 'bg-red-500';
    if (probability >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="w-full">
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${config.height}`}>
        <div
          className={`${config.height} ${getColor()} transition-all duration-500`}
          style={{ width: `${probability}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className={`text-gray-500 ${config.label}`}>Low Risk</span>
        <span className={`font-medium ${config.label} ${getColor().replace('bg-', 'text-').replace('-500', '-600')}`}>
          {probability}% Churn Risk
        </span>
        <span className={`text-gray-500 ${config.label}`}>High Risk</span>
      </div>
    </div>
  );
}

interface LTVGaugeProps {
  value: number;
  maxValue?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function LTVGauge({ value, maxValue = 100000, size = 'md' }: LTVGaugeProps) {
  const sizeConfig = {
    sm: { height: 'h-1.5', label: 'text-xs' },
    md: { height: 'h-2.5', label: 'text-sm' },
    lg: { height: 'h-4', label: 'text-lg' },
  };

  const config = sizeConfig[size];
  const percentage = Math.min((value / maxValue) * 100, 100);

  const getGradient = () => {
    if (value >= 50000) return 'from-purple-500 to-purple-600';
    if (value >= 25000) return 'from-blue-500 to-blue-600';
    if (value >= 10000) return 'from-green-500 to-green-600';
    return 'from-gray-400 to-gray-500';
  };

  return (
    <div className="w-full">
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${config.height}`}>
        <div
          className={`${config.height} bg-gradient-to-r ${getGradient()} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className={`font-semibold mt-1 ${config.label}`}>
        Predicted LTV: ${value.toLocaleString()}
      </div>
    </div>
  );
}
