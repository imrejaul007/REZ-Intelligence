import React, { useState } from 'react';
import { useInsights } from '../hooks/useCustomer';
import { ProfileCard } from '../components/ProfileCard';
import { PredictionBadge } from '../components/PredictionBadge';
import type { Customer } from '../types';
import {
  AlertTriangle,
  TrendingUp,
  Users,
  TrendingDown,
  RefreshCw,
  Loader2,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from 'lucide-react';

interface InsightsProps {
  onSelectCustomer?: (customerId: string) => void;
}

type InsightTab = 'at-risk' | 'high-value' | 'churners' | 'engagement';

export function Insights({ onSelectCustomer }: InsightsProps) {
  const [activeTab, setActiveTab] = useState<InsightTab>('at-risk');
  const { insights, loading, error, refetch } = useInsights();

  const tabs = [
    { id: 'at-risk' as const, label: 'At Risk', icon: AlertTriangle, color: 'text-red-600' },
    { id: 'high-value' as const, label: 'High Value', icon: TrendingUp, color: 'text-green-600' },
    { id: 'churners' as const, label: 'Churners', icon: TrendingDown, color: 'text-orange-600' },
    { id: 'engagement' as const, label: 'Engagement', icon: Activity, color: 'text-blue-600' },
  ];

  const getCurrentCustomers = (): Customer[] => {
    if (!insights) return [];
    switch (activeTab) {
      case 'at-risk':
        return insights.atRiskCustomers;
      case 'high-value':
        return insights.highValueCustomers;
      case 'churners':
        return insights.recentChurners;
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-red-700">{error.message}</p>
        <button
          onClick={refetch}
          className="mt-2 text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const currentCustomers = getCurrentCustomers();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Insights</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI-powered insights and predictions for your customer base
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">At Risk</p>
              <p className="text-3xl font-bold text-red-700 mt-1">
                {insights?.atRiskCustomers.length || 0}
              </p>
            </div>
            <div className="p-3 bg-red-200/50 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-xs text-red-600/70 mt-2">Customers with high churn probability</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">High Value</p>
              <p className="text-3xl font-bold text-green-700 mt-1">
                {insights?.highValueCustomers.length || 0}
              </p>
            </div>
            <div className="p-3 bg-green-200/50 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-green-600/70 mt-2">Platinum & Gold tier customers</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-medium">Likely Churners</p>
              <p className="text-3xl font-bold text-orange-700 mt-1">
                {insights?.recentChurners.length || 0}
              </p>
            </div>
            <div className="p-3 bg-orange-200/50 rounded-xl">
              <TrendingDown className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-xs text-orange-600/70 mt-2">Customers with 70%+ churn score</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Avg Engagement</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">
                {insights?.engagementTrends.length
                  ? Math.round(
                      insights.engagementTrends[insights.engagementTrends.length - 1]?.score || 0
                    )
                  : 0}
                %
              </p>
            </div>
            <div className="p-3 bg-blue-200/50 rounded-xl">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
            <ArrowUpRight className="w-3 h-3" />
            <span>+8% from last month</span>
          </div>
        </div>
      </div>

      {/* Engagement Trend Chart */}
      {activeTab === 'engagement' && insights?.engagementTrends && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Engagement Trend</h2>
          <div className="h-48 flex items-end gap-2">
            {insights.engagementTrends.map((point, index) => {
              const height = (point.score / 100) * 100;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-gradient-to-t from-primary-500 to-primary-400 rounded-t transition-all hover:from-primary-600 hover:to-primary-500"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-xs text-gray-500 transform -rotate-45 origin-top-left">
                    {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <div>
              <span className="text-gray-500">Current Score:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {insights.engagementTrends[insights.engagementTrends.length - 1]?.score}%
              </span>
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <ArrowUpRight className="w-4 h-4" />
              <span className="font-medium">+12% growth</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {activeTab !== 'engagement' && (
        <>
          <div className="border-b border-gray-200">
            <nav className="flex gap-1">
              {tabs.slice(0, 3).map((tab) => {
                const Icon = tab.icon;
                const count =
                  tab.id === 'at-risk'
                    ? insights?.atRiskCustomers.length || 0
                    : tab.id === 'high-value'
                    ? insights?.highValueCustomers.length || 0
                    : insights?.recentChurners.length || 0;
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
                    <Icon className={`w-4 h-4 ${tab.color}`} />
                    {tab.label}
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Customer List */}
          <div className="space-y-4">
            {currentCustomers.length > 0 ? (
              currentCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={
                        customer.avatar ||
                        `https://ui-avatars.com/api/?name=${customer.firstName}+${customer.lastName}`
                      }
                      alt={`${customer.firstName} ${customer.lastName}`}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">
                          {customer.firstName} {customer.lastName}
                        </h3>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-700 capitalize">
                          {customer.tier}
                        </span>
                        <PredictionBadge
                          type="churn"
                          score={customer.churnProbability}
                          risk={customer.riskLevel}
                          size="sm"
                        />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{customer.email}</p>
                      <div className="flex items-center gap-6 mt-3 text-sm">
                        <div>
                          <span className="text-gray-500">Total Spend:</span>
                          <span className="ml-1 font-medium text-gray-900">
                            ${customer.totalSpend.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Orders:</span>
                          <span className="ml-1 font-medium text-gray-900">{customer.totalOrders}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Engagement:</span>
                          <span className="ml-1 font-medium text-gray-900">{customer.engagementScore}%</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Predicted LTV:</span>
                          <span className="ml-1 font-medium text-gray-900">
                            ${customer.predictedLTV.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        onClick={() => onSelectCustomer?.(customer.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        View Profile
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                        Add to Campaign
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Users className="w-12 h-12 mb-2" />
                <p>No customers in this category</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-colors">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Win-back Campaign</p>
              <p className="text-sm text-gray-500">Target at-risk customers</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-colors">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">VIP Appreciation</p>
              <p className="text-sm text-gray-500">Reward high-value customers</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-colors">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Engagement Boost</p>
              <p className="text-sm text-gray-500">Re-engage dormant customers</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
