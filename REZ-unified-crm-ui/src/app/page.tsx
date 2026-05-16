'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Clock,
  Activity,
  LogOut,
  Search,
  Filter,
  MoreHorizontal,
  Star,
  ChevronRight,
  MessageCircle,
  Bell,
  Menu,
  X,
} from 'lucide-react';
import {
  getAuthToken,
  logout,
  getCurrentMerchant,
  getCustomers,
  getSegments,
  getInboxChannels,
  getAnalytics,
  type MerchantCustomer,
  type MerchantSegment,
  type InboxChannel,
  type AnalyticsOverview,
} from '@/lib/api';

// Stat Card Component
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

// Customer Row Component
function CustomerRow({ customer }: { customer: MerchantCustomer }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium">
            {customer.name.split(' ').map((n: string) => n[0]).join('')}
          </div>
          <div>
            <p className="font-medium text-gray-900">{customer.name}</p>
            <p className="text-sm text-gray-500">{customer.phone}</p>
          </div>
        </div>
      </td>
      <td className="py-4 px-4 text-center">
        <span className="text-gray-900">{customer.totalOrders}</span>
      </td>
      <td className="py-4 px-4 text-center">
        <span className="font-medium text-gray-900">₹{customer.totalSpend.toLocaleString()}</span>
      </td>
      <td className="py-4 px-4 text-center">
        <div className="flex items-center justify-center gap-2">
          {customer.segments.map((seg: string) => (
            <span
              key={seg}
              className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full"
            >
              {seg}
            </span>
          ))}
        </div>
      </td>
      <td className="py-4 px-4 text-center text-gray-500">
        {customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString() : 'N/A'}
      </td>
      <td className="py-4 px-4">
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </td>
    </tr>
  );
}

// Segment Card Component
function SegmentCard({ segment, rank }: { segment: MerchantSegment; rank: number }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:border-purple-200 transition-colors cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
          {rank}
        </div>
        <div>
          <p className="font-medium text-gray-900">{segment.name}</p>
          <p className="text-sm text-gray-500">{segment.customerCount} customers</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-gray-900">₹{(segment.totalRevenue / 1000).toFixed(0)}K</p>
      </div>
    </div>
  );
}

// Main Dashboard
export default function CRMDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'segments' | 'inbox'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [merchant, setMerchant] = useState<{ merchantId: string; merchantName: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Data state
  const [customers, setCustomers] = useState<MerchantCustomer[]>([]);
  const [segments, setSegments] = useState<MerchantSegment[]>([]);
  const [channels, setChannels] = useState<InboxChannel[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);

  // Check auth on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.push('/login');
      return;
    }
    setIsAuthenticated(true);

    // Fetch merchant info
    getCurrentMerchant()
      .then((res) => {
        if (res.success && res.data) {
          setMerchant(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  // Fetch data when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      try {
        const [customersRes, segmentsRes, channelsRes, analyticsRes] = await Promise.all([
          getCustomers({ limit: 10 }),
          getSegments(),
          getInboxChannels(),
          getAnalytics(),
        ]);

        setCustomers(customersRes.customers);
        setSegments(segmentsRes);
        setChannels(channelsRes);
        setAnalytics(analyticsRes);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  const handleLogout = useCallback(() => {
    logout();
    router.push('/login');
  }, [router]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'segments', label: 'Segments', icon: Star },
    { id: 'inbox', label: 'Inbox', icon: MessageCircle },
  ];

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">REZ</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Unified CRM</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{merchant?.merchantName}</p>
                <p className="text-xs text-gray-500">{merchant?.merchantId}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'inbox' && channels.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {channels.reduce((sum, c) => sum + c.unreadCount, 0)}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Customers"
                value={analytics?.totalCustomers || 0}
                change={analytics?.growth.customerGrowth}
                changeType="positive"
                icon={Users}
              />
              <StatCard
                title="Revenue (30d)"
                value={`₹${((analytics?.revenue?.total || 0) / 100000).toFixed(1)}L`}
                change={analytics?.growth.revenueGrowth}
                changeType="positive"
                icon={DollarSign}
              />
              <StatCard
                title="Orders (30d)"
                value={analytics?.revenue?.totalOrders || 0}
                change={analytics?.growth.orderGrowth}
                changeType="positive"
                icon={ShoppingCart}
              />
              <StatCard
                title="Retention Rate"
                value={`${analytics?.retention?.rate || 0}%`}
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
                  <button
                    onClick={() => setActiveTab('segments')}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {segments.slice(0, 5).map((segment, index) => (
                    <SegmentCard key={segment.id} segment={segment} rank={index + 1} />
                  ))}
                </div>
              </div>

              {/* Inbox Summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
                  <button
                    onClick={() => setActiveTab('inbox')}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {channels.slice(0, 4).map((channel) => (
                    <div key={channel.channel} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${channel.isConnected ? 'bg-purple-100' : 'bg-gray-200'}`}>
                          <Bell className={`w-4 h-4 ${channel.isConnected ? 'text-purple-600' : 'text-gray-400'}`} />
                        </div>
                        <span className="font-medium text-gray-900">{channel.name}</span>
                      </div>
                      {channel.unreadCount > 0 && (
                        <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                          {channel.unreadCount}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Customers */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Customers</h2>
                  <button
                    onClick={() => setActiveTab('customers')}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    View All
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
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Segments</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Last Visit</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.slice(0, 5).map((customer) => (
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-lg font-semibold text-gray-900">All Customers</h2>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search customers..."
                      className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <Filter className="w-5 h-5 text-gray-600" />
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
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Segments</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Last Visit</th>
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
            {segments.map((segment) => (
              <div key={segment.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{segment.name}</h3>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    {segment.customerCount}
                  </span>
                </div>
                {segment.description && (
                  <p className="text-sm text-gray-500 mb-4">{segment.description}</p>
                )}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Revenue</span>
                    <span className="font-medium text-gray-900">₹{(segment.totalRevenue / 1000).toFixed(0)}K</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'inbox' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Communication Channels</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {channels.map((channel) => (
                <div
                  key={channel.channel}
                  className={`p-4 rounded-xl border ${channel.isConnected ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'} transition-colors cursor-pointer`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${channel.isConnected ? 'bg-purple-100' : 'bg-gray-200'}`}>
                        <Bell className={`w-5 h-5 ${channel.isConnected ? 'text-purple-600' : 'text-gray-400'}`} />
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
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
