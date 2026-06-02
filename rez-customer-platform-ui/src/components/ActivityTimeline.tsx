import React from 'react';
import {
  ShoppingCart,
  Eye,
  Mail,
  Heart,
  Star,
  UserPlus,
  Package,
  MessageSquare,
} from 'lucide-react';

interface ActivityItem {
  date: string;
  type: string;
  description: string;
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
  maxItems?: number;
}

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  order: ShoppingCart,
  visit: Eye,
  email: Mail,
  wishlist: Heart,
  review: Star,
  signup: UserPlus,
  shipment: Package,
  support: MessageSquare,
};

const activityColors: Record<string, string> = {
  order: 'bg-green-100 text-green-600',
  visit: 'bg-blue-100 text-blue-600',
  email: 'bg-purple-100 text-purple-600',
  wishlist: 'bg-pink-100 text-pink-600',
  review: 'bg-yellow-100 text-yellow-600',
  signup: 'bg-indigo-100 text-indigo-600',
  shipment: 'bg-teal-100 text-teal-600',
  support: 'bg-orange-100 text-orange-600',
};

export function ActivityTimeline({ activities, maxItems }: ActivityTimelineProps) {
  const displayActivities = maxItems ? activities.slice(0, maxItems) : activities;

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <Package className="w-12 h-12 mb-2" />
        <p>No activity recorded</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {displayActivities.map((activity, index) => {
          const Icon = activityIcons[activity.type] || Package;
          const iconColorClass = activityColors[activity.type] || 'bg-gray-100 text-gray-600';

          return (
            <div key={index} className="relative flex gap-4 pl-2">
              {/* Icon */}
              <div
                className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${iconColorClass} flex items-center justify-center`}
              >
                <Icon className="w-5 h-5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(activity.date)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">{activity.type.replace('_', ' ')}</p>
              </div>
            </div>
          );
        })}
      </div>

      {maxItems && activities.length > maxItems && (
        <div className="pl-14 pt-2">
          <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            View all {activities.length} activities
          </button>
        </div>
      )}
    </div>
  );
}

interface OrderTimelineProps {
  orders: {
    id: string;
    date: string;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    total: number;
    itemCount: number;
  }[];
}

const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'Clock' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'Loader' },
  shipped: { bg: 'bg-purple-100', text: 'text-purple-600', icon: 'Truck' },
  delivered: { bg: 'bg-green-100', text: 'text-green-600', icon: 'CheckCircle' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-600', icon: 'XCircle' },
};

export function OrderTimeline({ orders }: OrderTimelineProps) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <ShoppingCart className="w-12 h-12 mb-2" />
        <p>No orders yet</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const statusStyle = statusColors[order.status];
        return (
          <div
            key={order.id}
            className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${statusStyle.bg} ${statusStyle.text} flex items-center justify-center`}>
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Order #{order.id}</p>
                <p className="text-sm text-gray-500">
                  {formatDate(order.date)} · {order.itemCount} items
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">${order.total.toFixed(2)}</p>
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                {order.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
