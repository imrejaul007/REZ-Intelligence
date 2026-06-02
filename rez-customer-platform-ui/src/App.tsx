import React, { useState } from 'react';
import { CustomerSearch } from './pages/CustomerSearch';
import { Customer360 } from './pages/Customer360';
import { Segments } from './pages/Segments';
import { Insights } from './pages/Insights';
import {
  Search,
  Users,
  BarChart3,
  Home,
  Bell,
  Settings,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';

type View = 'home' | 'search' | 'segments' | 'insights' | 'profile';

function App() {
  const [currentView, setCurrentView] = useState<View>('search');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCurrentView('profile');
  };

  const handleBackFromProfile = () => {
    setSelectedCustomerId(null);
    setCurrentView('search');
  };

  const navItems = [
    { id: 'search' as const, label: 'Search', icon: Search },
    { id: 'segments' as const, label: 'Segments', icon: Users },
    { id: 'insights' as const, label: 'Insights', icon: BarChart3 },
  ];

  const renderContent = () => {
    if (currentView === 'profile' && selectedCustomerId) {
      return (
        <Customer360
          customerId={selectedCustomerId}
          onBack={handleBackFromProfile}
        />
      );
    }

    switch (currentView) {
      case 'search':
        return <CustomerSearch onSelectCustomer={handleSelectCustomer} />;
      case 'segments':
        return <Segments onSelectCustomer={handleSelectCustomer} />;
      case 'insights':
        return <Insights onSelectCustomer={handleSelectCustomer} />;
      case 'home':
      default:
        return <CustomerSearch onSelectCustomer={handleSelectCustomer} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">Re</span>
              </div>
              <span className="font-semibold text-gray-900">Customer Platform</span>
            </div>
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm">Re</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {sidebarOpen ? (
              <ChevronDown className="w-5 h-5 text-gray-400 transform -rotate-90" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400 transform rotate-90" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setCurrentView(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                    {sidebarOpen && (
                      <span className={`font-medium ${isActive ? 'text-primary-600' : ''}`}>
                        {item.label}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200">
          <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'}`}>
            <img
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100"
              alt="User"
              className="w-10 h-10 rounded-full object-cover"
            />
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">Alex Morgan</p>
                <p className="text-xs text-gray-500 truncate">Admin</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 capitalize">
              {currentView === 'profile' ? 'Customer Profile' : currentView}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;
