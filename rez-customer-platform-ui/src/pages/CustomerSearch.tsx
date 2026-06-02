import React, { useState, useCallback } from 'react';
import { useSearch, useSegments } from '../hooks/useCustomer';
import { ProfileCard } from '../components/ProfileCard';
import { SegmentBadge } from '../components/SegmentBadge';
import type { SearchFilters, Customer } from '../types';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  SortAsc,
  X,
  Loader2,
} from 'lucide-react';

interface CustomerSearchProps {
  onSelectCustomer: (customerId: string) => void;
}

type SortOption = 'recent' | 'name' | 'spend' | 'orders' | 'engagement';

export function CustomerSearch({ onSelectCustomer }: CustomerSearchProps) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const { segments } = useSegments();

  const [filters, setFilters] = useState<SearchFilters>({
    segment: undefined,
    riskLevel: undefined,
    tier: undefined,
  });

  const { customers, total, page, totalPages, loading, error, search, setPage, currentFilters } = useSearch();

  const handleSearch = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      search({ ...filters, query }, 1);
    },
    [search, filters, query]
  );

  const handleFilterChange = (key: keyof SearchFilters, value: string | undefined) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    search({ ...newFilters, query }, 1);
  };

  const clearFilters = () => {
    setFilters({});
    setQuery('');
    search({}, 1);
  };

  const hasActiveFilters = Object.values(filters).some(Boolean) || query;

  const sortCustomers = (customers: Customer[]): Customer[] => {
    const sorted = [...customers];
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
      case 'spend':
        return sorted.sort((a, b) => b.totalSpend - a.totalSpend);
      case 'orders':
        return sorted.sort((a, b) => b.totalOrders - a.totalOrders);
      case 'engagement':
        return sorted.sort((a, b) => b.engagementScore - a.engagementScore);
      case 'recent':
      default:
        return sorted.sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());
    }
  };

  const sortedCustomers = sortCustomers(customers);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Search</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search and filter through {total.toLocaleString()} customers
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-3 border rounded-xl transition-colors ${
            showFilters || hasActiveFilters
              ? 'border-primary-500 bg-primary-50 text-primary-600'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter className="w-5 h-5" />
        </button>
      </form>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Segment Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Segment</label>
              <select
                value={filters.segment || ''}
                onChange={(e) => handleFilterChange('segment', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Segments</option>
                {segments.map((segment) => (
                  <option key={segment.id} value={segment.name}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Risk Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Risk Level</label>
              <select
                value={filters.riskLevel || ''}
                onChange={(e) => handleFilterChange('riskLevel', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Risk Levels</option>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>

            {/* Tier Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tier</label>
              <select
                value={filters.tier || ''}
                onChange={(e) => handleFilterChange('tier', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Tiers</option>
                <option value="bronze">Bronze</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="platinum">Platinum</option>
              </select>
            </div>
          </div>

          {/* Active Filters Tags */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {query && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                  Search: {query}
                  <button onClick={() => setQuery('')} className="hover:text-primary-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.segment && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  Segment: {filters.segment}
                  <button onClick={() => handleFilterChange('segment', undefined)} className="hover:text-blue-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.riskLevel && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                  Risk: {filters.riskLevel}
                  <button onClick={() => handleFilterChange('riskLevel', undefined)} className="hover:text-red-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filters.tier && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                  Tier: {filters.tier}
                  <button onClick={() => handleFilterChange('tier', undefined)} className="hover:text-purple-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {customers.length > 0 ? (page - 1) * 20 + 1 : 0} -{' '}
          {Math.min(page * 20, total)} of {total.toLocaleString()} results
        </p>
        <div className="flex items-center gap-2">
          <SortAsc className="w-4 h-4 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm border-0 bg-transparent focus:ring-0 text-gray-600 cursor-pointer"
          >
            <option value="recent">Most Recent</option>
            <option value="name">Name A-Z</option>
            <option value="spend">Highest Spend</option>
            <option value="orders">Most Orders</option>
            <option value="engagement">Highest Engagement</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700">{error.message}</p>
        </div>
      )}

      {/* Results Grid */}
      {!loading && !error && sortedCustomers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCustomers.map((customer) => (
            <div key={customer.id} onClick={() => onSelectCustomer(customer.id)}>
              <ProfileCard customer={customer} />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && sortedCustomers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Search className="w-12 h-12 mb-2" />
          <p className="text-lg font-medium">No customers found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
