'use client';

import { useState } from 'react';

// Types
interface ApprovalItem {
  id: string;
  type: 'campaign' | 'budget' | 'message' | 'action';
  title: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  content: any;
  notes?: string;
}

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  escalated: number;
}

export default function ApprovalDashboard() {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);

  // Mock data
  const [items, setItems] = useState<ApprovalItem[]>([
    {
      id: '1',
      type: 'campaign',
      title: 'Weekend Cashback Campaign',
      description: 'AI generated campaign to boost weekend traffic',
      requestedBy: 'HOJAI AI',
      requestedAt: new Date().toISOString(),
      priority: 'high',
      status: 'pending',
      content: {
        channels: ['WhatsApp', 'SMS'],
        budget: 15000,
        offer: '20% cashback',
        target: 'All customers',
        duration: 'Sat-Sun'
      }
    },
    {
      id: '2',
      type: 'budget',
      title: 'Budget Reallocation Request',
      description: 'Shift ₹5,000 from Email to WhatsApp',
      requestedBy: 'AI Budget Optimizer',
      requestedAt: new Date().toISOString(),
      priority: 'medium',
      status: 'pending',
      content: {
        fromChannel: 'Email',
        toChannel: 'WhatsApp',
        amount: 5000,
        reason: 'Better ROAS on WhatsApp (3.5x vs 2.1x)'
      }
    },
    {
      id: '3',
      type: 'message',
      title: 'Auto-generated Customer Message',
      description: 'Birthday wish with special offer',
      requestedBy: 'Loyalty Agent',
      requestedAt: new Date().toISOString(),
      priority: 'low',
      status: 'approved',
      content: {
        customerName: 'Rahul Sharma',
        message: 'Happy Birthday! 🎂 Enjoy 30% off your next visit. Valid this week only!',
        channel: 'WhatsApp'
      }
    },
    {
      id: '4',
      type: 'action',
      title: 'Pause Underperforming Campaign',
      description: 'Auto-pause campaign with < 1x ROAS',
      requestedBy: 'Campaign Optimizer',
      requestedAt: new Date().toISOString(),
      priority: 'urgent',
      status: 'escalated',
      content: {
        campaignId: 'c_123',
        campaignName: 'Old Year Sale',
        currentROAS: 0.8,
        threshold: 1.0,
        daysRunning: 14
      }
    }
  ]);

  const stats: ApprovalStats = {
    pending: items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    rejected: items.filter(i => i.status === 'rejected').length,
    escalated: items.filter(i => i.status === 'escalated').length
  };

  const filteredItems = items.filter(item => {
    if (activeTab === 'pending') return item.status === 'pending';
    if (activeTab === 'approved') return item.status === 'approved';
    return true;
  });

  const handleApprove = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, status: 'approved' } : i));
    setSelectedItem(null);
  };

  const handleReject = (id: string, notes: string) => {
    setItems(items.map(i => i.id === id ? { ...i, status: 'rejected', notes } : i));
    setSelectedItem(null);
  };

  const handleEscalate = (id: string, reason: string) => {
    setItems(items.map(i => i.id === id ? { ...i, status: 'escalated', notes: reason } : i));
    setSelectedItem(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500';
      case 'approved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500';
      case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500';
      case 'escalated': return 'bg-purple-500/20 text-purple-400 border-purple-500';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-slate-400';
      default: return 'text-slate-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'campaign': return '📢';
      case 'budget': return '💰';
      case 'message': return '💬';
      case 'action': return '⚡';
      default: return '📋';
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">Human Approval Center</h1>
            <span className="text-sm text-slate-400">Human-in-the-Loop Governance</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-4 py-2 bg-slate-700 rounded-lg text-sm text-slate-300">
              🔔 {stats.escalated} Escalated
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
              M
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-72 bg-slate-800 border-r border-slate-700 p-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-amber-400">{stats.pending}</div>
              <div className="text-xs text-slate-400">Pending</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-emerald-400">{stats.approved}</div>
              <div className="text-xs text-slate-400">Approved</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
              <div className="text-xs text-slate-400">Rejected</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-400">{stats.escalated}</div>
              <div className="text-xs text-slate-400">Escalated</div>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('pending')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                activeTab === 'pending' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              ⏳ Pending Approvals ({stats.pending})
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                activeTab === 'approved' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              ✅ Approved
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                activeTab === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'
              }`}
            >
              📋 All Items
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Items List */}
            <div className="space-y-3">
              <h2 className="text-lg font-medium text-white mb-4">
                {activeTab === 'pending' ? 'Pending Approvals' : activeTab === 'approved' ? 'Recently Approved' : 'All Items'}
              </h2>

              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <div className="text-4xl mb-4">✅</div>
                  <p>No items to display</p>
                </div>
              ) : (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`bg-slate-800 border rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors ${
                      selectedItem?.id === item.id ? 'border-blue-500' : 'border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getTypeIcon(item.type)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <span className={`text-xs ${getPriorityColor(item.priority)}`}>
                        {item.priority.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="font-medium text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-400 mb-2">{item.description}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>By: {item.requestedBy}</span>
                      <span>{new Date(item.requestedAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Detail Panel */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              {selectedItem ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-xl mr-2">{getTypeIcon(selectedItem.type)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(selectedItem.status)}`}>
                        {selectedItem.status}
                      </span>
                    </div>
                    <span className={`text-sm ${getPriorityColor(selectedItem.priority)}`}>
                      {selectedItem.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>

                  <h2 className="text-xl font-semibold text-white mb-2">{selectedItem.title}</h2>
                  <p className="text-slate-400 mb-4">{selectedItem.description}</p>

                  <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">Content Preview</h4>
                    <pre className="text-xs text-slate-400 overflow-auto">
                      {JSON.stringify(selectedItem.content, null, 2)}
                    </pre>
                  </div>

                  <div className="text-sm text-slate-500 mb-4">
                    <div>Requested by: {selectedItem.requestedBy}</div>
                    <div>At: {new Date(selectedItem.requestedAt).toLocaleString()}</div>
                  </div>

                  {selectedItem.notes && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                      <div className="text-sm text-amber-400">Notes:</div>
                      <div className="text-sm text-slate-300">{selectedItem.notes}</div>
                    </div>
                  )}

                  {selectedItem.status === 'pending' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(selectedItem.id)}
                        className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => handleReject(selectedItem.id, 'Does not align with strategy')}
                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                      >
                        ❌ Reject
                      </button>
                      <button
                        onClick={() => handleEscalate(selectedItem.id, 'Needs manager approval')}
                        className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
                      >
                        ⬆️ Escalate
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <div className="text-center">
                    <div className="text-4xl mb-4">👆</div>
                    <p>Select an item to view details</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
