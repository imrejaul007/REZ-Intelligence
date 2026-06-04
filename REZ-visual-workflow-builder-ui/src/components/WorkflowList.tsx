'use client';

import { useState, useEffect } from 'react';
import { Workflow } from '@/lib/types';

interface Props {
  onEdit: (workflow: Workflow) => void;
}

export function WorkflowList({ onEdit }: Props) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'paused'>('all');

  useEffect(() => {
    // Mock data for demo
    const mockWorkflows: Workflow[] = [
      {
        id: '1',
        name: 'Welcome Sequence',
        description: 'Send welcome message to new customers',
        merchantId: 'm1',
        status: 'active',
        nodes: [],
        edges: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastRun: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Abandoned Cart Recovery',
        description: 'Recover abandoned carts via WhatsApp',
        merchantId: 'm1',
        status: 'active',
        nodes: [],
        edges: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastRun: new Date().toISOString()
      },
      {
        id: '3',
        name: 'Win-Back Campaign',
        description: 'Re-engage inactive customers',
        merchantId: 'm1',
        status: 'draft',
        nodes: [],
        edges: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '4',
        name: 'Loyalty Tier Upgrade',
        description: 'Motivate Silver to Gold upgrade',
        merchantId: 'm1',
        status: 'paused',
        nodes: [],
        edges: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    setWorkflows(mockWorkflows);
    setLoading(false);
  }, []);

  const filteredWorkflows = workflows.filter(w => {
    if (filter === 'all') return true;
    return w.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500';
      case 'draft': return 'bg-slate-500/20 text-slate-400 border-slate-500';
      case 'paused': return 'bg-amber-500/20 text-amber-400 border-amber-500';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'active', 'draft', 'paused'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-md text-sm capitalize ${
              filter === status ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Workflow Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkflows.map(workflow => (
          <div
            key={workflow.id}
            className="card hover:border-blue-500 cursor-pointer transition-colors"
            onClick={() => onEdit(workflow)}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-medium text-white">{workflow.name}</h3>
              <span className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(workflow.status)}`}>
                {workflow.status}
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-4">{workflow.description}</p>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{workflow.nodes?.length || 0} nodes</span>
              {workflow.lastRun && (
                <span>Last run: {new Date(workflow.lastRun).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {filteredWorkflows.length === 0 && (
          <div className="col-span-full text-center py-12">
            <p className="text-slate-500 mb-4">No workflows found</p>
          </div>
        )}
      </div>
    </div>
  );
}
