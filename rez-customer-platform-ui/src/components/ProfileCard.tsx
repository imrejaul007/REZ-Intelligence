import React from 'react';
import type { Customer } from '../types';
import { Mail, Phone, MapPin, Calendar, ShoppingBag, DollarSign, TrendingUp } from 'lucide-react';

interface ProfileCardProps {
  customer: Customer;
  onClick?: () => void;
  compact?: boolean;
}

const tierColors = {
  bronze: 'bg-amber-100 text-amber-800 border-amber-200',
  silver: 'bg-slate-100 text-slate-700 border-slate-200',
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  platinum: 'bg-purple-100 text-purple-800 border-purple-200',
};

const riskColors = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

export function ProfileCard({ customer, onClick, compact = false }: ProfileCardProps) {
  if (compact) {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-sm cursor-pointer transition-all"
      >
        <img
          src={customer.avatar || `https://ui-avatars.com/api/?name=${customer.firstName}+${customer.lastName}`}
          alt={`${customer.firstName} ${customer.lastName}`}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {customer.firstName} {customer.lastName}
          </p>
          <p className="text-sm text-gray-500 truncate">{customer.email}</p>
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${tierColors[customer.tier]}`}>
          {customer.tier}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-primary-300 hover:shadow-lg cursor-pointer transition-all"
    >
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
        <div className="flex items-start gap-4">
          <img
            src={customer.avatar || `https://ui-avatars.com/api/?name=${customer.firstName}+${customer.lastName}`}
            alt={`${customer.firstName} ${customer.lastName}`}
            className="w-16 h-16 rounded-full object-cover border-2 border-white"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">
                {customer.firstName} {customer.lastName}
              </h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${tierColors[customer.tier]}`}>
                {customer.tier}
              </span>
            </div>
            <p className="text-primary-100 text-sm mt-1">{customer.segment}</p>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded ${riskColors[customer.riskLevel]}`}>
            {customer.riskLevel} risk
          </span>
        </div>
      </div>

      {/* Contact Info */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="truncate">{customer.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4 text-gray-400" />
            <span>{customer.phone}</span>
          </div>
          {customer.address && (
            <div className="flex items-center gap-2 text-sm text-gray-600 col-span-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="truncate">
                {customer.address.city}, {customer.address.state}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>Joined {new Date(customer.joinDate).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="px-6 py-4 grid grid-cols-4 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center w-10 h-10 mx-auto bg-primary-50 rounded-lg">
            <ShoppingBag className="w-5 h-5 text-primary-600" />
          </div>
          <p className="mt-2 text-lg font-semibold text-gray-900">{customer.totalOrders}</p>
          <p className="text-xs text-gray-500">Orders</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center w-10 h-10 mx-auto bg-green-50 rounded-lg">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            ${customer.totalSpend.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Total Spend</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center w-10 h-10 mx-auto bg-blue-50 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            ${customer.averageOrderValue.toFixed(0)}
          </p>
          <p className="text-xs text-gray-500">Avg Order</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center w-10 h-10 mx-auto bg-purple-50 rounded-lg">
            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="mt-2 text-lg font-semibold text-gray-900">{customer.engagementScore}%</p>
          <p className="text-xs text-gray-500">Engagement</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
        <button className="flex-1 py-1.5 px-3 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
          View Profile
        </button>
        <button className="flex-1 py-1.5 px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          Send Message
        </button>
        <button className="flex-1 py-1.5 px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          Add to Campaign
        </button>
      </div>
    </div>
  );
}
