'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Clock,
  AlertTriangle,
  MessageCircle,
  Mail,
  MessageSquare,
  Bell,
  Instagram,
  Smartphone,
  ChevronRight,
  Search,
  Filter,
  MoreHorizontal,
  Star,
  Heart,
  Coffee,
  Calendar,
  Activity,
} from 'lucide-react';

// Types
interface DashboardData {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  returningCustomers: number;
  revenue: { total: number; averageOrderValue: number; totalOrders: number };
  engagement: { averageEngagementScore: number; activeUsers: number };
  growth: { customerGrowth: number; revenueGrowth: number; orderGrowth: number; retentionRate: number };
  topSegments: Array<{ segmentName: string; customerCount: number; revenue: number; growth: number }>;
  alerts: Array<{ id: string; type: string; title: string; description: string }>;
}

interface Customer {
  id: string;
  fullName: string;
  phone: string;
  lifetime: { totalOrders: number; totalSpend: number; averageOrderValue: number };
  segments: string[];
  engagement: { score: number; tier: string };
  predictions: { churnRisk: string; churnProbability: number };
  smartTags: Array<{ name: string; slug: string; color: string }>;
}

interface Channel {
  channel: string;
  name: string;
  icon: string;
  unreadCount: number;
  isConnected: boolean;
}

// Mock data
const mockDashboard: DashboardData = {
  totalCustomers: 1070,
  activeCustomers: 890,
  newCustomersThisMonth: 120,
  returningCustomers: 520,
  revenue: { total: 1897000, averageOrderValue: 1627, totalOrders: 2340 },
  engagement: { averageEngagementScore: 65, activeUsers: 890 },
  growth: { customerGrowth: 8.5, revenueGrowth: 15.2, orderGrowth: 11.4, retentionRate: 85 },
  topSegments: [
    { segmentName: 'Champions', customerCount: 150, revenue: 450000, growth: 12.5 },
    { segmentName: 'Loyal Customers', customerCount: 320, revenue: 640000, growth: 8.2 },
    { segmentName: 'Potential Loyalists', customerCount: 280, revenue: 420000, growth: 15.3 },
    { segmentName: 'At Risk', customerCount: 120, revenue: 180000, growth: -5.2 },
    { segmentName: 'New Customers', customerCount: 200, revenue: 200000, growth: 25.0 },
  ],
  alerts: [
    { id: '1', type: 'WARNING', title: '45 customers at risk of churn', description: 'These customers have shown declining engagement.' },
    { id: '2', type: 'INFO', title: 'Campaign "Weekend Special" sent', description: 'Reached 1,250 customers with 32% open rate.' },
  ],
};

const mockCustomers: Customer[] = [
  {
    id: '1',
    fullName: 'Rahul Sharma',
    phone: '+91 98765 43210',
    lifetime: { totalOrders: 45, totalSpend: 125000, averageOrderValue: 2778 },
    segments: ['Champions', 'VIP'],
    engagement: { score: 92, tier: 'Champion' },
    predictions: { churnRisk: 'LOW', churnProbability: 0.05 },
    smartTags: [
      { name: 'High Spender', slug: 'high_spender', color: '#9333ea' },
      { name: 'Weekend Visitor', slug: 'weekend_visitor', color: '#3b82f6' },
    ],
  },
  {
    id: '2',
    fullName: 'Priya Patel',
    phone: '+91 87654 32109',
    lifetime: { totalOrders: 28, totalSpend: 72000, averageOrderValue: 2571 },
    segments: ['Loyal'],
    engagement: { score: 78, tier: 'Hot' },
    predictions: { churnRisk: 'LOW', churnProbability: 0.12 },
    smartTags: [
      { name: 'Family Customer', slug: 'family_customer', color: '#f59e0b' },
      { name: 'Late Night', slug: 'late_night_customer', color: '#6366f1' },
    ],
  },
  {
    id: '3',
    fullName: 'Amit Kumar',
    phone: '+91 76543 21098',
    lifetime: { totalOrders: 8, totalSpend: 18000, averageOrderValue: 2250 },
    segments: ['Potential Loyalists'],
    engagement: { score: 55, tier: 'Warm' },
    predictions: { churnRisk: 'MEDIUM', churnProbability: 0.45 },
    smartTags: [
      { name: 'At Risk', slug: 'at_risk', color: '#ef4444' },
    ],
  },
  {
    id: '4',
    fullName: 'Sneha Reddy',
    phone: '+91 65432 10987',
    lifetime: { totalOrders: 15, totalSpend: 38000, averageOrderValue: 2533 },
    segments: ['Potential Loyalists'],
    engagement: { score: 62, tier: 'Hot' },
    predictions: { churnRisk: 'LOW', churnProbability: 0.18 },
    smartTags: [
      { name: 'Coffee Addict', slug: 'coffee_addict', color: '#78350f' },
      { name: 'Fitness Focused', slug: 'fitness_focused', color: '#06b6d4' },
    ],
  },
  {
    id: '5',
    fullName: 'Vikram Singh',
    phone: '+91 54321 09876',
    lifetime: { totalOrders: 52, totalSpend: 156000, averageOrderValue: 3000 },
    segments: ['Champions'],
    engagement: { score: 95, tier: 'Champion' },
    predictions: { churnRisk: 'NONE', churnProbability: 0.01 },
    smartTags: [
      { name: 'High Spender', slug: 'high_spender', color: '#9333ea' },
      { name: 'Brand Loyalist', slug: 'brand_loyalist', color: '#8b5cf6' },
    ],
  },
];

const mockChannels: Channel[] = [
  { channel: 'WHATSAPP', name: 'WhatsApp', icon: 'message-circle', unreadCount: 12, isConnected: true },
  { channel: 'INSTAGRAM', name: 'Instagram', icon: 'instagram', unreadCount: 5, isConnected: true },
  { channel: 'SMS', name: 'SMS', icon: 'message-square', unreadCount: 3, isConnected: true },
  { channel: 'APP_PUSH', name: 'App Push', icon: 'bell', unreadCount: 8, isConnected: true },
  { channel: 'EMAIL', name: 'Email', icon: 'mail', unreadCount: 0, isConnected: false },
  { channel: 'SUPPORT', name: 'Support', icon: 'headphones', unreadCount: 2, isConnected: true },
];

// Components
function StatCard({ title, value, change, changeType, icon: Icon }: any) {
  const isPositive = changeType === 'positive';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {typeof value === 'number' ? (
              value.toLocaleString()
            ) : (
              value
            )}
          </p>
          {change !== undefined && (
            <div className={`flex items-center mt-2 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              <span>{Math.abs(change).toFixed(1)}% vs last month</span>
            </div>
          )}
        </div>
        <div className="p-3 bg-purple-100 rounded-lg">
          <Icon className="w-6 h-6 text-purple-600" />
        </div>
      </div>
    </div>
  );
}

function SegmentCard({ segment, rank }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:border-purple-200 transition-colors cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
          {rank}
        </div>
        <div>
          <p className="font-medium text-gray-900">{segment.segmentName}</p>
          <p className="text-sm text-gray-500">{segment.customerCount} customers</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-gray-900">₹{(segment.revenue / 1000).toFixed(0)}K</p>
        <p className={`text-sm ${segment.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {segment.growth >= 0 ? '+' : ''}{segment.growth.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}

function CustomerRow({ customer }: { customer: Customer }) {
  const riskColors: Record<string, string> = {
    LOW: 'bg-green-100 text-green-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    HIGH: 'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-700',
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium">
            {customer.fullName.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <p className="font-medium text-gray-900">{customer.fullName}</p>
            <p className="text-sm text-gray-500">{customer.phone}</p>
          </div>
        </div>
      </td>
      <td className="py-4 px-4 text-center">
        <span className="text-gray-900">{customer.lifetime.totalOrders}</span>
      </td>
      <td className="py-4 px-4 text-center">
        <span className="font-medium text-gray-900">₹{customer.lifetime.totalSpend.toLocaleString()}</span>
      </td>
      <td className="py-4 px-4 text-center">
        <div className="flex items-center justify-center gap-1">
          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              style={{ width: `${customer.engagement.score}%` }}
            />
          </div>
          <span className="text-sm text-gray-600 ml-2">{customer.engagement.score}</span>
        </div>
      </td>
      <td className="py-4 px-4 text-center">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${riskColors[customer.predictions.churnRisk]}`}>
          {customer.predictions.churnRisk}
        </span>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center justify-center gap-1">
          {customer.smartTags.slice(0, 3).map((tag) => (
            <span
              key={tag.slug}
              className="px-2 py-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          {customer.smartTags.length > 3 && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              +{customer.smartTags.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="py-4 px-4">
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </td>
    </tr>
  );
}

function ChannelCard({ channel }: { channel: Channel }) {
  const iconMap: Record<string, any> = {
    'message-circle': MessageCircle,
    'instagram': Instagram,
    'message-square': MessageSquare,
    'bell': Bell,
    'mail': Mail,
    'headphones': MessageSquare,
  };
  const Icon = iconMap[channel.icon] || MessageCircle;

  return (
    <div className={`p-4 rounded-xl border ${channel.isConnected ? 'border-gray-200 bg-white hover:border-purple-200' : 'border-gray-100 bg-gray-50 opacity-60'} transition-colors cursor-pointer`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${channel.isConnected ? 'bg-purple-100' : 'bg-gray-200'}`}>
            <Icon className={`w-5 h-5 ${channel.isConnected ? 'text-purple-600' : 'text-gray-400'}`} />
          </div>
          <span className="font-medium text-gray-900">{channel.name}</span>
        </div>
        {channel.unreadCount > 0 && (
          <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
            {channel.unreadCount}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500">
        {channel.isConnected ? 'Connected' : 'Not connected'}
      </p>
    </div>
  );
}

function AlertCard({ alert }: { alert: DashboardData['alerts'][0] }) {
  const typeStyles: Record<string, string> = {
    WARNING: 'border-l-yellow-500 bg-yellow-50',
    INFO: 'border-l-blue-500 bg-blue-50',
    URGENT: 'border-l-red-500 bg-red-50',
  };

  return (
    <div className={`p-4 rounded-lg border-l-4 ${typeStyles[alert.type]}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 mt-0.5 ${alert.type === 'WARNING' ? 'text-yellow-600' : alert.type === 'INFO' ? 'text-blue-600' : 'text-red-600'}`} />
        <div>
          <p className="font-medium text-gray-900">{alert.title}</p>
          <p className="text-sm text-gray-600 mt-1">{alert.description}</p>
        </div>
      </div>
    </div>
  );
}

// Main Dashboard
export default function CRMDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'segments' | 'tags' | 'inbox'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'segments', label: 'Segments', icon: Star },
    { id: 'tags', label: 'Smart Tags', icon: Heart },
    { id: 'inbox', label: 'Inbox', icon: MessageCircle },
  ];

  const filteredCustomers = mockCustomers.filter(c =>
    c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">REZ</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Unified CRM</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <Filter className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <MoreHorizontal className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-1 mt-4 -mb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'inbox' && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">28</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Customers"
                value={mockDashboard.totalCustomers}
                change={mockDashboard.growth.customerGrowth}
                changeType="positive"
                icon={Users}
              />
              <StatCard
                title="Revenue (30d)"
                value={`₹${(mockDashboard.revenue.total / 100000).toFixed(1)}L`}
                change={mockDashboard.growth.revenueGrowth}
                changeType="positive"
                icon={DollarSign}
              />
              <StatCard
                title="Orders (30d)"
                value={mockDashboard.revenue.totalOrders}
                change={mockDashboard.growth.orderGrowth}
                changeType="positive"
                icon={ShoppingCart}
              />
              <StatCard
                title="Retention Rate"
                value={`${mockDashboard.growth.retentionRate}%`}
                change={2.3}
                changeType="positive"
                icon={Clock}
              />
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top Segments */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Top Customer Segments</h2>
                  <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {mockDashboard.topSegments.map((segment, index) => (
                    <SegmentCard key={segment.segmentName} segment={segment} rank={index + 1} />
                  ))}
                </div>
              </div>

              {/* Alerts */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Alerts</h2>
                <div className="space-y-3">
                  {mockDashboard.alerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              </div>
            </div>

            {/* Top Customers */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Top Customers</h2>
                  <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                    View All Customers
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Orders</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Total Spend</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Engagement</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Churn Risk</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Tags</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockCustomers.slice(0, 5).map((customer) => (
                      <CustomerRow key={customer.id} customer={customer} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">All Customers</h2>
                <div className="flex items-center gap-3">
                  <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option>All Segments</option>
                    <option>Champions</option>
                    <option>Loyal</option>
                    <option>At Risk</option>
                  </select>
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                    Export
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Orders</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Total Spend</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Engagement</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Churn Risk</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Tags</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <CustomerRow key={customer.id} customer={customer} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'segments' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockDashboard.topSegments.map((segment) => (
              <div key={segment.segmentName} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{segment.segmentName}</h3>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    {segment.customerCount}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Revenue</span>
                    <span className="font-medium text-gray-900">₹{(segment.revenue / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Growth</span>
                    <span className={`font-medium ${segment.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {segment.growth >= 0 ? '+' : ''}{segment.growth.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'tags' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { name: 'High Spender', count: 245, color: '#9333ea' },
              { name: 'Weekend Visitor', count: 380, color: '#3b82f6' },
              { name: 'Late Night', count: 165, color: '#6366f1' },
              { name: 'Brand Loyalist', count: 520, color: '#8b5cf6' },
              { name: 'Returning Customer', count: 680, color: '#84cc16' },
              { name: 'Churn Risk', count: 85, color: '#ef4444' },
              { name: 'Vegan Customer', count: 120, color: '#22c55e' },
              { name: 'Fitness Focused', count: 95, color: '#06b6d4' },
            ].map((tag) => (
              <div
                key={tag.name}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${tag.color}20` }}
                >
                  <Star className="w-5 h-5" style={{ color: tag.color }} />
                </div>
                <h3 className="font-medium text-gray-900">{tag.name}</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">{tag.count}</p>
                <p className="text-sm text-gray-500">customers</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'inbox' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Communication Channels</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {mockChannels.map((channel) => (
                <ChannelCard key={channel.channel} channel={channel} />
              ))}
            </div>

            <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Recent Messages</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {[
                  { name: 'Rahul Sharma', message: 'Thanks for the order!', time: '2 min ago', channel: 'WHATSAPP' },
                  { name: 'Priya Patel', message: 'Is the weekend special still available?', time: '5 min ago', channel: 'INSTAGRAM' },
                  { name: 'Amit Kumar', message: 'Order #12345 delivered', time: '12 min ago', channel: 'APP_PUSH' },
                ].map((msg, i) => (
                  <div key={i} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium">
                      {msg.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{msg.name}</p>
                      <p className="text-sm text-gray-500">{msg.message}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">{msg.time}</span>
                      <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {msg.channel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
