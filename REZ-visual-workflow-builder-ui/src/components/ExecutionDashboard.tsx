'use client';

import { useState } from 'react';

interface Props {
  onClose: () => void;
}

export function ExecutionDashboard({ onClose }: Props) {
  const [executions] = useState([
    { id: '1', workflow: 'Welcome Sequence', status: 'completed', startedAt: '2024-01-15T10:30:00', completedAt: '2024-01-15T10:31:00', steps: 5 },
    { id: '2', workflow: 'Abandoned Cart Recovery', status: 'running', startedAt: '2024-01-15T11:00:00', steps: 3 },
    { id: '3', workflow: 'Win-Back Campaign', status: 'failed', startedAt: '2024-01-15T09:00:00', error: 'API timeout' }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/20 text-emerald-400';
      case 'running': return 'bg-blue-500/20 text-blue-400';
      case 'failed': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Execution History</h2>
        <button onClick={onClose} className="btn btn-ghost">
          Close
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: executions.length, color: 'text-white' },
          { label: 'Completed', value: executions.filter(e => e.status === 'completed').length, color: 'text-emerald-400' },
          { label: 'Running', value: executions.filter(e => e.status === 'running').length, color: 'text-blue-400' },
          { label: 'Failed', value: executions.filter(e => e.status === 'failed').length, color: 'text-red-400' }
        ].map(stat => (
          <div key={stat.label} className="card text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-sm text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Executions List */}
      <div className="space-y-3">
        {executions.map(exec => (
          <div key={exec.id} className="card hover:border-slate-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(exec.status)}`}>
                  {exec.status}
                </div>
                <div>
                  <div className="font-medium text-white">{exec.workflow}</div>
                  <div className="text-sm text-slate-500">
                    {new Date(exec.startedAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-400">{exec.steps} steps</div>
                {exec.completedAt && (
                  <div className="text-xs text-slate-500">
                    Duration: {Math.round((new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000)}s
                  </div>
                )}
                {exec.error && (
                  <div className="text-xs text-red-400 mt-1">{exec.error}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
