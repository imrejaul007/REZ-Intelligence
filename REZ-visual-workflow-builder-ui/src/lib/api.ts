// API client for REZ Workflow Builder service

const API_BASE = process.env.NEXT_PUBLIC_WORKFLOW_API_URL || 'http://localhost:4215';

export interface Workflow {
  id: string;
  name: string;
  description: string;
  merchantId: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  nodes: any[];
  edges: any[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  steps: {
    nodeId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    output?: any;
    error?: string;
  }[];
}

class WorkflowAPI {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Workflows
  async getWorkflows(merchantId: string): Promise<Workflow[]> {
    return this.request<Workflow[]>(`/api/workflows/${merchantId}`);
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return this.request<Workflow>(`/api/workflows/id/${id}`);
  }

  async createWorkflow(workflow: Partial<Workflow>): Promise<Workflow> {
    return this.request<Workflow>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  }

  async updateWorkflow(id: string, workflow: Partial<Workflow>): Promise<Workflow> {
    return this.request<Workflow>(`/api/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflow),
    });
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.request(`/api/workflows/${id}`, { method: 'DELETE' });
  }

  async executeWorkflow(id: string): Promise<{ executionId: string }> {
    return this.request<{ executionId: string }>(`/api/workflows/${id}/execute`, {
      method: 'POST',
    });
  }

  // Workflow Templates
  async getTemplates(category?: string): Promise<any[]> {
    const url = category ? `/api/templates?category=${category}` : '/api/templates';
    return this.request<any[]>(url);
  }

  async createFromTemplate(templateId: string, merchantId: string): Promise<Workflow> {
    return this.request<Workflow>('/api/workflows/from-template', {
      method: 'POST',
      body: JSON.stringify({ templateId, merchantId }),
    });
  }

  // Executions
  async getExecutions(workflowId: string): Promise<WorkflowExecution[]> {
    return this.request<WorkflowExecution[]>(`/api/executions/${workflowId}`);
  }

  async getExecution(executionId: string): Promise<WorkflowExecution> {
    return this.request<WorkflowExecution>(`/api/executions/id/${executionId}`);
  }

  async pauseExecution(executionId: string): Promise<void> {
    await this.request(`/api/executions/${executionId}/pause`, { method: 'POST' });
  }

  async resumeExecution(executionId: string): Promise<void> {
    await this.request(`/api/executions/${executionId}/resume`, { method: 'POST' });
  }

  // Stats
  async getStats(merchantId: string): Promise<any> {
    return this.request<any>(`/api/stats/${merchantId}`);
  }
}

export const workflowApi = new WorkflowAPI(API_BASE);
