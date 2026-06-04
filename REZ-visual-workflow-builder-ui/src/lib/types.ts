// Workflow types
export type NodeType = 'trigger' | 'action' | 'logic' | 'flow';

export interface Position {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  category: string;
  name: string;
  description: string;
  position: Position;
  config: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  merchantId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: 'draft' | 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
  lastRun?: string;
}

// Node definitions
export interface NodeDefinition {
  type: NodeType;
  category: string;
  name: string;
  description: string;
  icon: string;
  configFields: ConfigField[];
}

export interface ConfigField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'json';
  label: string;
  required?: boolean;
  defaultValue?: any;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

// Trigger nodes
export const TRIGGER_NODES: NodeDefinition[] = [
  {
    type: 'trigger',
    category: 'schedule',
    name: 'Schedule',
    description: 'Run workflow on a schedule',
    icon: 'Clock',
    configFields: [
      { name: 'cron', type: 'string', label: 'Cron Expression', required: true, placeholder: '0 9 * * 1-5' },
      { name: 'timezone', type: 'string', label: 'Timezone', defaultValue: 'Asia/Kolkata' }
    ]
  },
  {
    type: 'trigger',
    category: 'event',
    name: 'Event',
    description: 'Run when event occurs',
    icon: 'Zap',
    configFields: [
      { name: 'event', type: 'select', label: 'Event Type', required: true, options: [
        { value: 'order_created', label: 'Order Created' },
        { value: 'order_completed', label: 'Order Completed' },
        { value: 'customer_signup', label: 'Customer Signup' },
        { value: 'cart_abandoned', label: 'Cart Abandoned' },
        { value: 'review_received', label: 'Review Received' }
      ]}
    ]
  },
  {
    type: 'trigger',
    category: 'webhook',
    name: 'Webhook',
    description: 'Run via webhook trigger',
    icon: 'Webhook',
    configFields: [
      { name: 'webhookId', type: 'string', label: 'Webhook ID', required: true }
    ]
  },
  {
    type: 'trigger',
    category: 'manual',
    name: 'Manual',
    description: 'Start workflow manually',
    icon: 'Play',
    configFields: []
  }
];

// Action nodes
export const ACTION_NODES: NodeDefinition[] = [
  {
    type: 'action',
    category: 'message',
    name: 'Send WhatsApp',
    description: 'Send WhatsApp message',
    icon: 'MessageCircle',
    configFields: [
      { name: 'template', type: 'select', label: 'Template', required: true, options: [
        { value: 'promotional', label: 'Promotional' },
        { value: 'transactional', label: 'Transactional' },
        { value: 'reminder', label: 'Reminder' }
      ]},
      { name: 'message', type: 'string', label: 'Message', required: true, placeholder: 'Enter message...' }
    ]
  },
  {
    type: 'action',
    category: 'message',
    name: 'Send SMS',
    description: 'Send SMS message',
    icon: 'Smartphone',
    configFields: [
      { name: 'message', type: 'string', label: 'Message', required: true }
    ]
  },
  {
    type: 'action',
    category: 'message',
    name: 'Send Email',
    description: 'Send email',
    icon: 'Mail',
    configFields: [
      { name: 'subject', type: 'string', label: 'Subject', required: true },
      { name: 'body', type: 'string', label: 'Body', required: true }
    ]
  },
  {
    type: 'action',
    category: 'message',
    name: 'Push Notification',
    description: 'Send push notification',
    icon: 'Bell',
    configFields: [
      { name: 'title', type: 'string', label: 'Title', required: true },
      { name: 'body', type: 'string', label: 'Body', required: true }
    ]
  },
  {
    type: 'action',
    category: 'campaign',
    name: 'Create Campaign',
    description: 'Create marketing campaign',
    icon: 'Megaphone',
    configFields: [
      { name: 'name', type: 'string', label: 'Campaign Name', required: true },
      { name: 'channel', type: 'select', label: 'Channel', required: true, options: [
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'sms', label: 'SMS' },
        { value: 'email', label: 'Email' },
        { value: 'push', label: 'Push Notification' }
      ]}
    ]
  },
  {
    type: 'action',
    category: 'crm',
    name: 'Update CRM',
    description: 'Update customer in CRM',
    icon: 'Database',
    configFields: [
      { name: 'field', type: 'string', label: 'Field', required: true },
      { name: 'value', type: 'string', label: 'Value', required: true }
    ]
  },
  {
    type: 'action',
    category: 'loyalty',
    name: 'Add Points',
    description: 'Add loyalty points',
    icon: 'Gift',
    configFields: [
      { name: 'points', type: 'number', label: 'Points', required: true },
      { name: 'reason', type: 'string', label: 'Reason' }
    ]
  }
];

// Logic nodes
export const LOGIC_NODES: NodeDefinition[] = [
  {
    type: 'logic',
    category: 'condition',
    name: 'If/Else',
    description: 'Branch based on condition',
    icon: 'GitBranch',
    configFields: [
      { name: 'field', type: 'string', label: 'Field', required: true },
      { name: 'operator', type: 'select', label: 'Operator', required: true, options: [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' },
        { value: 'greater_than', label: 'Greater Than' },
        { value: 'less_than', label: 'Less Than' },
        { value: 'contains', label: 'Contains' }
      ]},
      { name: 'value', type: 'string', label: 'Value', required: true }
    ]
  },
  {
    type: 'logic',
    category: 'filter',
    name: 'Filter',
    description: 'Filter audience segment',
    icon: 'Filter',
    configFields: [
      { name: 'segment', type: 'select', label: 'Segment', required: true, options: [
        { value: 'all', label: 'All Customers' },
        { value: 'active', label: 'Active Customers' },
        { value: 'inactive', label: 'Inactive (30+ days)' },
        { value: 'vip', label: 'VIP Customers' },
        { value: 'new', label: 'New Customers' }
      ]}
    ]
  },
  {
    type: 'logic',
    category: 'split',
    name: 'A/B Split',
    description: 'Split audience for testing',
    icon: 'Split',
    configFields: [
      { name: 'percentage', type: 'number', label: 'Test Group %', required: true, defaultValue: 50 },
      { name: 'variantA', type: 'string', label: 'Variant A Name' },
      { name: 'variantB', type: 'string', label: 'Variant B Name' }
    ]
  }
];

// Flow nodes
export const FLOW_NODES: NodeDefinition[] = [
  {
    type: 'flow',
    category: 'delay',
    name: 'Delay',
    description: 'Wait before next step',
    icon: 'Clock',
    configFields: [
      { name: 'duration', type: 'number', label: 'Duration', required: true },
      { name: 'unit', type: 'select', label: 'Unit', required: true, options: [
        { value: 'minutes', label: 'Minutes' },
        { value: 'hours', label: 'Hours' },
        { value: 'days', label: 'Days' }
      ]}
    ]
  },
  {
    type: 'flow',
    category: 'wait',
    name: 'Wait Until',
    description: 'Wait until specific time',
    icon: 'Calendar',
    configFields: [
      { name: 'time', type: 'string', label: 'Time (HH:MM)', placeholder: '09:00' },
      { name: 'days', type: 'select', label: 'Days', options: [
        { value: 'all', label: 'All Days' },
        { value: 'weekdays', label: 'Weekdays Only' },
        { value: 'weekends', label: 'Weekends Only' }
      ]}
    ]
  },
  {
    type: 'flow',
    category: 'loop',
    name: 'For Each',
    description: 'Loop through items',
    icon: 'Repeat',
    configFields: [
      { name: 'collection', type: 'string', label: 'Collection', required: true },
      { name: 'itemName', type: 'string', label: 'Item Variable Name', defaultValue: 'item' }
    ]
  },
  {
    type: 'flow',
    category: 'end',
    name: 'End',
    description: 'End workflow',
    icon: 'Square',
    configFields: []
  }
];

// All nodes
export const ALL_NODE_DEFINITIONS = [
  ...TRIGGER_NODES,
  ...ACTION_NODES,
  ...LOGIC_NODES,
  ...FLOW_NODES
];

// Node colors
export const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string }> = {
  trigger: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400' },
  action: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400' },
  logic: { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-400' },
  flow: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400' }
};
