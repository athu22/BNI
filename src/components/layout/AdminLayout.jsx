import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  UserCog,
  LogOut,
  Handshake
} from 'lucide-react';
import { cn } from '../../utils/cn';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Members', href: '/admin/members', icon: Users },
  { name: 'Tables', href: '/admin/tables', icon: LayoutDashboard },
  { name: 'Rounds', href: '/admin/rounds', icon: LayoutDashboard },
  { name: 'Referrals', href: '/admin/referrals', icon: Handshake },
  { name: 'User Management', href: '/admin/users', icon: UserCog }
];

export default function AdminLayout() {
  const { logout, currentUser } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen print:h-auto print:block bg-gray-50 print:bg-white">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex print:hidden">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <div className="w-8 h-8 bg-bni-red rounded flex items-center justify-center mr-3">
            <span className="text-white font-bold text-xs">BNI</span>
          </div>
          <span className="text-lg font-bold text-gray-900">Admin Portal</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/admin' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  isActive ? 'bg-red-50 text-bni-red' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors'
                )}
              >
                <item.icon
                  className={cn(
                    isActive ? 'text-bni-red' : 'text-gray-400 group-hover:text-gray-500',
                    'mr-3 flex-shrink-0 h-5 w-5'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center px-3 py-2">
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">{currentUser?.username || 'Admin'}</p>
              <p className="text-xs font-medium text-gray-500 truncate">{currentUser?.role}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="mt-2 w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sign out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:block">
        {/* Mobile Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:hidden print:hidden">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-bni-red rounded flex items-center justify-center mr-3">
              <span className="text-white font-bold text-xs">BNI</span>
            </div>
            <span className="text-lg font-bold text-gray-900">Admin Portal</span>
          </div>
          <button onClick={() => logout()} className="text-red-600">
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto print:overflow-visible p-6 md:p-8 print:p-0 print:m-0">
          <div className="max-w-7xl mx-auto print:max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
