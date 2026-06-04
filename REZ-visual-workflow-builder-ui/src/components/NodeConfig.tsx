'use client';

import { useState } from 'react';
import { WorkflowNode, ALL_NODE_DEFINITIONS, NODE_COLORS } from '@/lib/types';

interface Props {
  node: WorkflowNode;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function NodeConfig({ node, onUpdate, onDelete, onClose }: Props) {
  const [config, setConfig] = useState(node.config);

  const definition = ALL_NODE_DEFINITIONS.find(
    d => d.type === node.type && d.category === node.category
  );

  const handleConfigChange = (fieldName: string, value: any) => {
    const newConfig = { ...config, [fieldName]: value };
    setConfig(newConfig);
    onUpdate({ config: newConfig });
  };

  const colors = NODE_COLORS[node.type];

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded ${colors.bg.replace('/20', '')}`} />
          <h3 className="font-medium text-white">{node.name}</h3>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Config Fields */}
      <div className="space-y-4">
        {definition?.configFields.map(field => (
          <div key={field.name}>
            <label className="block text-sm text-slate-400 mb-1">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {field.type === 'string' && (
              <input
                type="text"
                value={config[field.name] || ''}
                onChange={e => handleConfigChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                className="input"
              />
            )}

            {field.type === 'number' && (
              <input
                type="number"
                value={config[field.name] || ''}
                onChange={e => handleConfigChange(field.name, Number(e.target.value))}
                className="input"
              />
            )}

            {field.type === 'boolean' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config[field.name] || false}
                  onChange={e => handleConfigChange(field.name, e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700"
                />
                <span className="text-sm text-slate-300">Enabled</span>
              </label>
            )}

            {field.type === 'select' && field.options && (
              <select
                value={config[field.name] || ''}
                onChange={e => handleConfigChange(field.name, e.target.value)}
                className="select"
              >
                <option value="">Select...</option>
                {field.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}

            {field.type === 'json' && (
              <textarea
                value={typeof config[field.name] === 'object'
                  ? JSON.stringify(config[field.name], null, 2)
                  : config[field.name] || ''
                }
                onChange={e => {
                  try {
                    handleConfigChange(field.name, JSON.parse(e.target.value));
                  } catch {
                    handleConfigChange(field.name, e.target.value);
                  }
                }}
                className="input font-mono text-xs h-24"
              />
            )}
          </div>
        ))}

        {(!definition?.configFields || definition.configFields.length === 0) && (
          <p className="text-sm text-slate-500 italic">No configuration needed</p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 pt-4 border-t border-slate-700 flex gap-2">
        <button onClick={onDelete} className="btn btn-danger flex-1">
          Delete
        </button>
      </div>
    </div>
  );
}
