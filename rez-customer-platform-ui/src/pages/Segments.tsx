import React, { useState } from 'react';
import { useSegments, useSegment } from '../hooks/useCustomer';
import { SegmentCard, SegmentBadge } from '../components/SegmentBadge';
import { ProfileCard } from '../components/ProfileCard';
import type { Segment } from '../types';
import {
  Users,
  Plus,
  ArrowLeft,
  Settings,
  Edit,
  Trash2,
  Filter,
  Loader2,
  BarChart3,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

interface SegmentsProps {
  onSelectCustomer?: (customerId: string) => void;
}

export function Segments({ onSelectCustomer }: SegmentsProps) {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const { segments, loading, error } = useSegments();
  const { segment, customers, loading: loadingCustomers } = useSegment(selectedSegmentId);

  const handleSelectSegment = (segmentId: string) => {
    setSelectedSegmentId(segmentId);
    setView('detail');
  };

  const handleBack = () => {
    setSelectedSegmentId(null);
    setView('list');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-red-700">Failed to load segments</p>
      </div>
    );
  }

  if (view === 'detail' && segment) {
    return (
      <SegmentDetail
        segment={segment}
        customers={customers}
        loading={loadingCustomers}
        onBack={handleBack}
        onSelectCustomer={onSelectCustomer}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Segments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage customer segments based on behavior and attributes
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <Plus className="w-5 h-5" />
          Create Segment
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{segments.length}</p>
              <p className="text-sm text-gray-500">Total Segments</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {segments.reduce((sum, s) => sum + s.customerCount, 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Total Customers</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                $
                {(
                  segments.reduce((sum, s) => sum + s.avgLTV * s.customerCount, 0) /
                  segments.reduce((sum, s) => sum + s.customerCount, 0)
                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-gray-500">Avg LTV</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(
                  segments.reduce((sum, s) => sum + s.avgEngagement * s.customerCount, 0) /
                    segments.reduce((sum, s) => sum + s.customerCount, 0)
                )}
                %
              </p>
              <p className="text-sm text-gray-500">Avg Engagement</p>
            </div>
          </div>
        </div>
      </div>

      {/* Segments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {segments.map((segment) => (
          <div key={segment.id} onClick={() => handleSelectSegment(segment.id)}>
            <SegmentCard
              name={segment.name}
              description={segment.description}
              customerCount={segment.customerCount}
              avgLTV={segment.avgLTV}
              avgEngagement={segment.avgEngagement}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface SegmentDetailProps {
  segment: Segment;
  customers: ReturnType<typeof useSegment>['customers'];
  loading: boolean;
  onBack: () => void;
  onSelectCustomer?: (customerId: string) => void;
}

function SegmentDetail({ segment, customers, loading, onBack, onSelectCustomer }: SegmentDetailProps) {
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{segment.name}</h1>
          <p className="text-sm text-gray-500">{segment.description}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <Edit className="w-4 h-4" />
            Edit
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Customers</p>
          <p className="text-2xl font-bold text-gray-900">{segment.customerCount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Avg LTV</p>
          <p className="text-2xl font-bold text-gray-900">${segment.avgLTV.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Avg Engagement</p>
          <p className="text-2xl font-bold text-gray-900">{segment.avgEngagement}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Last Updated</p>
          <p className="text-2xl font-bold text-gray-900">
            {new Date(segment.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Segment Rules */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowRules(!showRules)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-gray-900">Segment Rules</span>
          </div>
          <span className="text-sm text-gray-500">{segment.rules.length} rules</span>
        </button>
        {showRules && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <div className="space-y-3">
              {segment.rules.map((rule, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200"
                >
                  <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-sm font-medium">
                    {rule.field}
                  </span>
                  <span className="text-gray-500">{rule.operator.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                    {Array.isArray(rule.value)
                      ? `${rule.value[0]} - ${rule.value[1]}`
                      : typeof rule.value === 'number'
                      ? rule.value
                      : rule.value}
                  </span>
                  {index < segment.rules.length - 1 && (
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">AND</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Customers in Segment */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Customers in Segment</h2>
          <span className="text-sm text-gray-500">{customers.length} customers</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : customers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => onSelectCustomer?.(customer.id)}
              >
                <ProfileCard customer={customer} compact />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
            <Users className="w-12 h-12 mb-2" />
            <p>No customers in this segment</p>
          </div>
        )}
      </div>
    </div>
  );
}
