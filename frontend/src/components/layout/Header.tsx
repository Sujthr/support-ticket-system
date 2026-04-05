'use client';

import { useState, useEffect } from 'react';
import { BellIcon, MagnifyingGlassIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { notificationsApi } from '@/lib/api';

export default function Header() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check system preference
    const isDark = document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');

    // Fetch unread notifications
    notificationsApi.unreadCount()
      .then(res => setUnreadCount(res.data.count))
      .catch(() => {});
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex-1 max-w-lg">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tickets..."
            className="input pl-10 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {darkMode ? (
            <SunIcon className="w-5 h-5 text-yellow-500" />
          ) : (
            <MoonIcon className="w-5 h-5 text-gray-500" />
          )}
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <BellIcon className="w-5 h-5 text-gray-500" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
