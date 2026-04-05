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
import { branding, getCopyrightText } from '@/lib/branding';
import BrandLogo from '@/components/common/BrandLogo';

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
      {/* Brand Logo */}
      <div className="h-16 flex items-center px-5 border-b border-gray-200 dark:border-gray-800">
        <BrandLogo size="sm" orgLogo={organization?.logo} />
      </div>

      {/* Org section */}
      {organization && (
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            {organization.logo ? (
              <img src={organization.logo} alt={organization.name} className="w-7 h-7 rounded-md object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                {organization.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{organization.name}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">{organization.slug}</p>
            </div>
          </div>
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
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
              )}
            >
              <item.icon className={cn('w-5 h-5', isActive && 'text-primary-600 dark:text-primary-400')} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Copyright */}
      {branding.showCopyright && (
        <div className="px-5 py-2 border-t border-gray-200 dark:border-gray-800">
          <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center">
            {getCopyrightText()}
          </p>
        </div>
      )}

      {/* User profile */}
      {user && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-sm font-medium text-white shadow-sm">
              {getInitials(user.firstName, user.lastName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">{user.role.replace('_', ' ')}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-500 transition-colors"
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
