'use client';

import { useState, useCallback } from 'react';
import { Workflow, WorkflowNode, NODE_COLORS } from '@/lib/types';
import { NodePalette } from './NodePalette';
import { NodeConfig } from './NodeConfig';
import { Canvas } from './Canvas';

interface Props {
  workflow: Workflow;
  onBack: () => void;
  onSave: (workflow: Workflow) => void;
}

export function WorkflowEditor({ workflow: initialWorkflow, onBack, onSave }: Props) {
  const [workflow, setWorkflow] = useState<Workflow>(initialWorkflow);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPalette, setShowPalette] = useState(true);

  const handleNodesChange = useCallback((nodes: WorkflowNode[]) => {
    setWorkflow(prev => ({ ...prev, nodes }));
  }, []);

  const handleEdgesChange = useCallback((edges: Workflow['edges']) => {
    setWorkflow(prev => ({ ...prev, edges }));
  }, []);

  const handleAddNode = useCallback((node: WorkflowNode) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, node]
    }));
  }, []);

  const handleUpdateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n)
    }));
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      edges: prev.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    }));
    setSelectedNode(null);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // In production, call API here
      await new Promise(resolve => setTimeout(resolve, 500));
      onSave(workflow);
    } finally {
      setIsSaving(false);
    }
  }, [workflow, onSave]);

  const handleExecute = useCallback(async () => {
    // Trigger workflow execution
    alert('Workflow execution triggered! (API call to execute workflow)');
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-slate-800 border-b border-slate-700 px-4 py-2">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="btn btn-ghost flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <input
            type="text"
            value={workflow.name}
            onChange={e => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
            className="bg-transparent border-none text-lg font-medium text-white focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="btn btn-ghost"
          >
            {showPalette ? 'Hide Palette' : 'Show Palette'}
          </button>
          <button onClick={handleExecute} className="btn btn-secondary">
            Execute
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node Palette */}
        {showPalette && (
          <div className="w-72 bg-slate-800 border-r border-slate-700 overflow-y-auto">
            <NodePalette onAddNode={handleAddNode} />
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 relative">
          <Canvas
            nodes={workflow.nodes}
            edges={workflow.edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeSelect={setSelectedNode}
          />
        </div>

        {/* Config Panel */}
        {selectedNode && (
          <div className="w-80 bg-slate-800 border-l border-slate-700 overflow-y-auto">
            <NodeConfig
              node={selectedNode}
              onUpdate={updates => handleUpdateNode(selectedNode.id, updates)}
              onDelete={() => handleDeleteNode(selectedNode.id)}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
