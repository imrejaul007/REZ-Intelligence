'use client';

import { useState } from 'react';
import { Workflow } from '@/lib/types';

interface Props {
  onClose: () => void;
  onCreate: (workflow: Workflow) => void;
}

export function CreateWorkflowModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;

    const workflow: Workflow = {
      id: `wf_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      merchantId: 'current_merchant',
      nodes: [],
      edges: [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onCreate(workflow);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Create Workflow</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Welcome Sequence"
              className="input"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what this workflow does..."
              className="input h-24 resize-none"
            />
          </div>

          <div className="pt-2">
            <label className="block text-sm text-slate-400 mb-2">Start from Template</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Blank', icon: '📄' },
                { name: 'Welcome', icon: '👋' },
                { name: 'Abandoned Cart', icon: '🛒' },
                { name: 'Win-Back', icon: '💔' }
              ].map(template => (
                <button
                  key={template.name}
                  className="p-3 rounded-lg border border-slate-600 hover:border-blue-500 text-left transition-colors"
                >
                  <span className="text-lg">{template.icon}</span>
                  <div className="text-sm font-medium mt-1">{template.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="btn btn-primary flex-1"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
