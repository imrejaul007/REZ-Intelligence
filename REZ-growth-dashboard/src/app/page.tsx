'use client';

import { useState, useEffect } from 'react';

// Types
interface ServiceHealth {
  name: string;
  port: number;
  status: 'healthy' | 'unhealthy' | 'unknown';
  latency?: number;
}

interface DashboardStats {
  totalMerchants: number;
  activeCampaigns: number;
  totalBudget: number;
  avgHealthScore: number;
  conversions: number;
  revenue: number;
}

// Mock data
const services: ServiceHealth[] = [
  { name: 'Budget Optimizer', port: 4290, status: 'healthy', latency: 45 },
  { name: 'Growth Playbook', port: 4291, status: 'healthy', latency: 32 },
  { name: 'Incrementality Testing', port: 4292, status: 'healthy', latency: 78 },
  { name: 'Merchant Health Score', port: 4293, status: 'healthy', latency: 56 },
  { name: 'Offline Attribution', port: 4294, status: 'healthy', latency: 41 },
  { name: 'Competitor Alerts', port: 4295, status: 'healthy', latency: 38 },
  { name: 'Review Response', port: 4296, status: 'healthy', latency: 62 },
  { name: 'Unified Offer Brain', port: 4297, status: 'healthy', latency: 55 },
  { name: 'Autonomous Growth Agent', port: 4298, status: 'healthy', latency: 89 },
  { name: 'Prompt Studio', port: 4299, status: 'healthy', latency: 34 },
  { name: 'Approval UI', port: 4211, status: 'healthy', latency: 28 },
  { name: 'Real Pricing Tracker', port: 4212, status: 'healthy', latency: 67 },
  { name: 'Revenue Forecast', port: 4213, status: 'healthy', latency: 52 },
  { name: 'Neighborhood Analytics', port: 4214, status: 'healthy', latency: 48 },
];

const stats: DashboardStats = {
  totalMerchants: 1247,
  activeCampaigns: 89,
  totalBudget: 4520000,
  avgHealthScore: 78,
  conversions: 12456,
  revenue: 89700000
};

export default function MerchantGrowthDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'campaigns' | 'merchants'>('overview');
  const [servicesHealth, setServicesHealth] = useState<ServiceHealth[]>(services);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Merchant Growth OS
            </div>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">v1.0</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">
              + New Campaign
            </button>
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
              A
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-slate-800/50 border-b border-slate-700 px-6">
        <div className="flex gap-1">
          {(['overview', 'services', 'campaigns', 'merchants'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Merchants"
                value={stats.totalMerchants.toLocaleString()}
                change="+12%"
                positive={true}
                icon="🏪"
              />
              <StatCard
                title="Active Campaigns"
                value={stats.activeCampaigns.toString()}
                change="+8"
                positive={true}
                icon="📢"
              />
              <StatCard
                title="Total Budget"
                value={`₹${(stats.totalBudget / 100000).toFixed(1)}L`}
                change="+15%"
                positive={true}
                icon="💰"
              />
              <StatCard
                title="Avg Health Score"
                value={`${stats.avgHealthScore}%`}
                change="+3%"
                positive={true}
                icon="📊"
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Chart */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-medium mb-4">Revenue Trend</h3>
                <div className="h-48 flex items-end gap-2">
                  {[65, 72, 68, 78, 82, 88, 85, 92, 88, 95, 91, 98].map((val, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t"
                      style={{ height: `${val}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                  <span>Jan</span>
                  <span>Dec</span>
                </div>
              </div>

              {/* Channel Performance */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-medium mb-4">Channel Performance</h3>
                <div className="space-y-3">
                  {[
                    { name: 'WhatsApp', value: 85, color: 'bg-green-500' },
                    { name: 'Instagram', value: 72, color: 'bg-pink-500' },
                    { name: 'SMS', value: 65, color: 'bg-blue-500' },
                    { name: 'Email', value: 58, color: 'bg-yellow-500' },
                    { name: 'Push', value: 45, color: 'bg-purple-500' },
                  ].map(channel => (
                    <div key={channel.name} className="flex items-center gap-3">
                      <span className="w-20 text-sm text-slate-400">{channel.name}</span>
                      <div className="flex-1 bg-slate-700 rounded-full h-2">
                        <div
                          className={`${channel.color} rounded-full h-2 transition-all`}
                          style={{ width: `${channel.value}%` }}
                        />
                      </div>
                      <span className="w-10 text-sm text-slate-300">{channel.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {[
                  { time: '2 min ago', action: 'New campaign launched', merchant: 'Pizza Palace', status: 'success' },
                  { time: '5 min ago', action: 'Budget reallocated', merchant: 'Burger King', status: 'success' },
                  { time: '12 min ago', action: 'Alert triggered', merchant: 'Taco Bell', status: 'warning' },
                  { time: '18 min ago', action: 'Health score updated', merchant: 'Subway', status: 'success' },
                  { time: '25 min ago', action: 'Offer optimized', merchant: 'KFC', status: 'success' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-slate-700/50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${
                      item.status === 'success' ? 'bg-green-500' :
                      item.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm text-slate-400 w-20">{item.time}</span>
                    <span className="text-sm flex-1">{item.action}</span>
                    <span className="text-sm text-slate-500">{item.merchant}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'services' && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-medium mb-4">Service Health</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servicesHealth.map(service => (
                <div key={service.name} className="bg-slate-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{service.name}</span>
                    <span className={`w-3 h-3 rounded-full ${
                      service.status === 'healthy' ? 'bg-green-500' :
                      service.status === 'unhealthy' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Port {service.port}</span>
                    <span>{service.latency}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-medium mb-4">Active Campaigns</h3>
            <p className="text-slate-400">Campaign management coming soon...</p>
          </div>
        )}

        {activeTab === 'merchants' && (
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-medium mb-4">Top Merchants</h3>
            <p className="text-slate-400">Merchant list coming soon...</p>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ title, value, change, positive, icon }: {
  title: string;
  value: string;
  change: string;
  positive: boolean;
  icon: string;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs px-2 py-1 rounded ${
          positive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {change}
        </span>
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm text-slate-400">{title}</div>
    </div>
  );
}
