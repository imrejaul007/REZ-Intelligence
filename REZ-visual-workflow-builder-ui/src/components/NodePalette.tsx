'use client';

import { useState } from 'react';
import { NodeDefinition, WorkflowNode, TRIGGER_NODES, ACTION_NODES, LOGIC_NODES, FLOW_NODES, NODE_COLORS } from '@/lib/types';
import * as Icons from 'lucide-react';

interface Props {
  onAddNode: (node: WorkflowNode) => void;
}

export function NodePalette({ onAddNode }: Props) {
  const [search, setSearch] = useState('');

  const filterNodes = (nodes: NodeDefinition[]) => {
    if (!search) return nodes;
    const s = search.toLowerCase();
    return nodes.filter(n =>
      n.name.toLowerCase().includes(s) ||
      n.description.toLowerCase().includes(s)
    );
  };

  const createNode = (def: NodeDefinition) => {
    const node: WorkflowNode = {
      id: `node_${Date.now()}`,
      type: def.type,
      category: def.category,
      name: def.name,
      description: def.description,
      position: { x: 250, y: 200 },
      config: def.configFields.reduce((acc, f) => {
        acc[f.name] = f.defaultValue || '';
        return acc;
      }, {} as Record<string, any>)
    };
    onAddNode(node);
  };

  const getIcon = (iconName: string) => {
    const Icon = (Icons as any)[iconName];
    return Icon ? <Icon className="w-4 h-4" /> : null;
  };

  const NodeSection = ({ title, nodes, color }: { title: string; nodes: NodeDefinition[]; color: string }) => {
    const filtered = filterNodes(nodes);
    if (filtered.length === 0) return null;

    return (
      <div className="mb-4">
        <h3 className={`text-xs font-semibold uppercase mb-2 px-3 ${NODE_COLORS[color as keyof typeof NODE_COLORS].text}`}>
          {title}
        </h3>
        <div className="space-y-1 px-2">
          {filtered.map((def, i) => (
            <button
              key={`${def.category}-${i}`}
              onClick={() => createNode(def)}
              className="w-full text-left palette-item hover:bg-slate-700 rounded-md p-2"
            >
              <div className={`w-8 h-8 rounded flex items-center justify-center ${NODE_COLORS[def.type as keyof typeof NODE_COLORS].bg}`}>
                {getIcon(def.icon)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{def.name}</div>
                <div className="text-xs text-slate-500 truncate">{def.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-white mb-4">Node Palette</h2>

      {/* Search */}
      <div className="relative mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search nodes..."
          className="input pl-9"
        />
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Node Categories */}
      <NodeSection title="Triggers" nodes={filterNodes(TRIGGER_NODES)} color="trigger" />
      <NodeSection title="Actions" nodes={filterNodes(ACTION_NODES)} color="action" />
      <NodeSection title="Logic" nodes={filterNodes(LOGIC_NODES)} color="logic" />
      <NodeSection title="Flow" nodes={filterNodes(FLOW_NODES)} color="flow" />
    </div>
  );
}
