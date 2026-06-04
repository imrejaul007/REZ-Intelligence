'use client';

import { useState, useCallback } from 'react';
import { WorkflowList } from '@/components/WorkflowList';
import { WorkflowEditor } from '@/components/WorkflowEditor';
import { CreateWorkflowModal } from '@/components/CreateWorkflowModal';
import { ExecutionDashboard } from '@/components/ExecutionDashboard';
import { Workflow } from '@/lib/types';

export default function WorkflowBuilderPage() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [view, setView] = useState<'list' | 'editor'>('list');

  const handleCreateWorkflow = useCallback((workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setShowCreateModal(false);
    setView('editor');
  }, []);

  const handleEditWorkflow = useCallback((workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setView('editor');
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedWorkflow(null);
    setView('list');
  }, []);

  const handleWorkflowSaved = useCallback((workflow: Workflow) => {
    setSelectedWorkflow(workflow);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">REZ Workflow Builder</h1>
            <nav className="flex gap-2 ml-8">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-md text-sm ${
                  view === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Workflows
              </button>
              <button
                onClick={() => setShowDashboard(true)}
                className={`px-3 py-1.5 rounded-md text-sm ${
                  showDashboard ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Executions
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Workflow
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {showDashboard ? (
          <ExecutionDashboard onClose={() => setShowDashboard(false)} />
        ) : view === 'list' ? (
          <WorkflowList onEdit={handleEditWorkflow} />
        ) : selectedWorkflow ? (
          <WorkflowEditor
            workflow={selectedWorkflow}
            onBack={handleBackToList}
            onSave={handleWorkflowSaved}
          />
        ) : (
          <div className="flex items-center justify-center h-96">
            <p className="text-slate-500">Select or create a workflow to get started</p>
          </div>
        )}
      </main>

      {/* Create Workflow Modal */}
      {showCreateModal && (
        <CreateWorkflowModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateWorkflow}
        />
      )}
    </div>
  );
}
