import React, { useState } from 'react';
import { useCustomer, usePredictions, useCustomerOrders, useCustomerActivity } from '../hooks/useCustomer';
import { ProfileCard } from '../components/ProfileCard';
import { PredictionBadge, ChurnMeter, LTVGauge } from '../components/PredictionBadge';
import { ActivityTimeline, OrderTimeline } from '../components/ActivityTimeline';
import { SegmentBadge } from '../components/SegmentBadge';
import {
  User,
  ShoppingBag,
  Heart,
  TrendingUp,
  Mail,
  MapPin,
  Calendar,
  Phone,
  Star,
  Target,
  Gift,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

interface Customer360Props {
  customerId: string;
  onBack: () => void;
}

type TabType = 'overview' | 'behavior' | 'preferences' | 'predictions' | 'actions';

export function Customer360({ customerId, onBack }: Customer360Props) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const { customer, loading, error } = useCustomer(customerId);
  const { predictions, loading: predictionsLoading } = usePredictions(customerId);
  const { orders, loading: ordersLoading } = useCustomerOrders(customerId);
  const { activity, loading: activityLoading } = useCustomerActivity(customerId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-red-600">Failed to load customer profile</p>
        <button onClick={onBack} className="mt-4 text-primary-600 hover:text-primary-700">
          Go back
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: User },
    { id: 'behavior' as const, label: 'Behavior', icon: ShoppingBag },
    { id: 'preferences' as const, label: 'Preferences', icon: Heart },
    { id: 'predictions' as const, label: 'Predictions', icon: TrendingUp },
    { id: 'actions' as const, label: 'Actions', icon: Target },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Customer 360 View</h1>
          <p className="text-sm text-gray-500">Complete customer profile and insights</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            Edit Profile
          </button>
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            Export
          </button>
        </div>
      </div>

      {/* Profile Summary */}
      <ProfileCard customer={customer} />

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span>{customer.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <span>{customer.phone}</span>
                </div>
                {customer.address && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <span>
                      {customer.address.street}, {customer.address.city}, {customer.address.state}{' '}
                      {customer.address.zipCode}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span>Member since {new Date(customer.joinDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Segment & Tier */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Segment & Tier</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Segment</p>
                  <SegmentBadge segment={customer.segment} size="lg" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Tier</p>
                  <div className="flex items-center gap-2">
                    <Star
                      className={`w-5 h-5 ${
                        customer.tier === 'platinum'
                          ? 'text-purple-500'
                          : customer.tier === 'gold'
                          ? 'text-yellow-500'
                          : customer.tier === 'silver'
                          ? 'text-gray-400'
                          : 'text-amber-600'
                      }`}
                      fill="currentColor"
                    />
                    <span className="font-medium capitalize">{customer.tier}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Risk Level</p>
                  <PredictionBadge type="churn" score={customer.churnProbability} risk={customer.riskLevel} />
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              {activityLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                </div>
              ) : (
                <ActivityTimeline activities={activity} maxItems={5} />
              )}
            </div>
          </div>
        )}

        {activeTab === 'behavior' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Purchase History */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order History</h3>
              {ordersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                </div>
              ) : (
                <OrderTimeline
                  orders={orders.map((o) => ({
                    id: o.id,
                    date: o.date,
                    status: o.status,
                    total: o.total,
                    itemCount: o.items.length,
                  }))}
                />
              )}
            </div>

            {/* Spending Insights */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending Insights</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-500">Total Lifetime Value</span>
                    <span className="font-semibold text-gray-900">${customer.predictedLTV.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600"
                      style={{ width: `${Math.min((customer.predictedLTV / 100000) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{customer.totalOrders}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Total Spend</p>
                    <p className="text-2xl font-bold text-gray-900">${customer.totalSpend.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Avg Order Value</p>
                    <p className="text-2xl font-bold text-gray-900">${customer.averageOrderValue.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Engagement Score</p>
                    <p className="text-2xl font-bold text-gray-900">{customer.engagementScore}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Communication Preferences */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Communication</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Preferred Channel</p>
                    <p className="text-sm text-gray-500 capitalize">{customer.preferences.channel}</p>
                  </div>
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Frequency</p>
                    <p className="text-sm text-gray-500 capitalize">{customer.preferences.frequency}</p>
                  </div>
                  <Calendar className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Marketing Opt-In</p>
                    <p className="text-sm text-gray-500">{customer.preferences.marketingOptIn ? 'Subscribed' : 'Not subscribed'}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    customer.preferences.marketingOptIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {customer.preferences.marketingOptIn ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Product Preferences */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Interests</h3>
              <div className="flex flex-wrap gap-2">
                {customer.preferences.categories.map((category) => (
                  <span
                    key={category}
                    className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm font-medium"
                  >
                    {category}
                  </span>
                ))}
              </div>
              <div className="mt-6">
                <p className="text-sm text-gray-500 mb-2">Communication Opt-In</p>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${
                    customer.preferences.communicationOptIn ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                    {customer.preferences.communicationOptIn && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">
                    {customer.preferences.communicationOptIn ? 'Opted in to receive communications' : 'Not opted in'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'predictions' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Churn Prediction */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Churn Risk Assessment</h3>
              <div className="space-y-6">
                {predictionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                  </div>
                ) : predictions ? (
                  <>
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-600">
                        <span className="text-3xl font-bold text-white">{predictions.churnScore}%</span>
                      </div>
                      <p className="mt-2 text-gray-500">Churn Probability</p>
                    </div>
                    <ChurnMeter probability={predictions.churnScore} size="lg" />
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        This customer has a <span className="font-semibold">{predictions.churnRisk}</span> of churning
                        within the next 30 days based on behavioral patterns and engagement metrics.
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* LTV Prediction */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Lifetime Value Prediction</h3>
              {predictionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                </div>
              ) : predictions ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-purple-600">
                      <span className="text-2xl font-bold text-white">${(predictions.predictedLTV / 1000).toFixed(0)}K</span>
                    </div>
                    <p className="mt-2 text-gray-500">Predicted Lifetime Value</p>
                  </div>
                  <LTVGauge value={predictions.predictedLTV} size="lg" />
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">LTV Tier</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        predictions.ltvTier === 'vip' ? 'bg-purple-100 text-purple-700' :
                        predictions.ltvTier === 'premium' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {predictions.ltvTier.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Recommended Actions</h3>
            {predictionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
            ) : predictions?.recommendedActions && predictions.recommendedActions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {predictions.recommendedActions.map((action) => (
                  <div
                    key={action.id}
                    className="bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        action.type === 'retention' ? 'bg-blue-100 text-blue-700' :
                        action.type === 'upsell' ? 'bg-green-100 text-green-700' :
                        action.type === 'winback' ? 'bg-red-100 text-red-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {action.type}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        action.priority === 'high' ? 'bg-red-100 text-red-700' :
                        action.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {action.priority} priority
                      </span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">{action.title}</h4>
                    <p className="text-sm text-gray-600 mb-4">{action.description}</p>
                    {action.campaignId && (
                      <button className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                        Launch Campaign
                      </button>
                    )}
                    {!action.campaignId && (
                      <button className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                        Create Campaign
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Gift className="w-12 h-12 mb-2" />
                <p>No recommended actions at this time</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
