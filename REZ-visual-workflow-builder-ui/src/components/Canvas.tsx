'use client';

import { useState, useCallback } from 'react';
import { WorkflowNode, WorkflowEdge, NODE_COLORS } from '@/lib/types';
import * as Icons from 'lucide-react';

interface Props {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  onNodeSelect: (node: WorkflowNode | null) => void;
}

export function Canvas({ nodes, edges, onNodesChange, onNodeSelect }: Props) {
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const getIcon = (iconName: string) => {
    const Icon = (Icons as any)[iconName];
    return Icon ? <Icon className="w-4 h-4" /> : null;
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, node: WorkflowNode) => {
    e.preventDefault();
    setDraggingNode(node.id);
    setDragOffset({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingNode) return;

    onNodesChange(nodes.map(n => {
      if (n.id === draggingNode) {
        return {
          ...n,
          position: {
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y
          }
        };
      }
      return n;
    }));
  }, [draggingNode, dragOffset, nodes, onNodesChange]);

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null);
  }, []);

  const handleNodeClick = useCallback((node: WorkflowNode) => {
    onNodeSelect(node);
  }, [onNodeSelect]);

  // Find connected edges for a node
  const getConnectedEdges = (nodeId: string) => {
    return edges.filter(e => e.source === nodeId || e.target === nodeId);
  };

  // Calculate edge path
  const getEdgePath = (source: WorkflowNode, target: WorkflowNode) => {
    const sx = source.position.x + 100; // Half of node width
    const sy = source.position.y + 40; // Half of node height
    const tx = target.position.x + 100;
    const ty = target.position.y + 40;

    const dx = tx - sx;
    const dy = ty - sy;

    return `M ${sx} ${sy} C ${sx + dx / 2} ${sy}, ${tx - dx / 2} ${ty}, ${tx} ${ty}`;
  };

  return (
    <div
      className="w-full h-full canvas-grid overflow-auto"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Edges */}
      <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748B" />
          </marker>
        </defs>
        {edges.map((edge, i) => {
          const source = nodes.find(n => n.id === edge.source);
          const target = nodes.find(n => n.id === edge.target);
          if (!source || !target) return null;

          return (
            <g key={edge.id || i}>
              <path
                d={getEdgePath(source, target)}
                fill="none"
                stroke="#64748B"
                strokeWidth={2}
                markerEnd="url(#arrowhead)"
              />
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      <div className="relative" style={{ width: 2000, height: 1500 }}>
        {nodes.map(node => {
          const colors = NODE_COLORS[node.type];
          const isConnected = getConnectedEdges(node.id).length > 0;

          return (
            <div
              key={node.id}
              className={`workflow-node ${node.type} absolute ${draggingNode === node.id ? 'dragging' : ''}`}
              style={{
                left: node.position.x,
                top: node.position.y,
                zIndex: draggingNode === node.id ? 100 : 1
              }}
              onMouseDown={e => handleMouseDown(e, node)}
              onClick={() => handleNodeClick(node)}
            >
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded flex items-center justify-center ${colors.bg}`}>
                  {getIcon(node.name.replace(/\s+/g, '').charAt(0).toUpperCase() + node.name.replace(/\s+/g, '').slice(1)) || 'Play'}
                </div>
                <div>
                  <div className="font-medium text-sm">{node.name}</div>
                  <div className="text-xs text-slate-500 capitalize">{node.category}</div>
                </div>
              </div>

              {/* Connection indicators */}
              {isConnected && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900" />
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <p className="text-slate-500 mb-2">No nodes yet</p>
              <p className="text-xs text-slate-600">Click nodes from the palette to add them</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
