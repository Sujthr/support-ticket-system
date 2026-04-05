'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  TicketIcon,
  ChartBarIcon,
  BookOpenIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/auth';
import { cn, getInitials } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Tickets', href: '/tickets', icon: TicketIcon },
  { name: 'My Tickets', href: '/tickets?view=my', icon: InboxIcon },
  { name: 'Knowledge Base', href: '/knowledge-base', icon: BookOpenIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon, roles: ['ADMIN', 'AGENT'] },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, roles: ['ADMIN'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, organization, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const filteredNav = navigation.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <TicketIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold">SupportDesk</span>
        </div>
      </div>

      {/* Org name */}
      {organization && (
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">Organization</p>
          <p className="text-sm font-medium truncate">{organization.name}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href.split('?')[0]));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User profile */}
      {user && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-sm font-medium text-primary-700 dark:text-primary-300">
              {getInitials(user.firstName, user.lastName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
