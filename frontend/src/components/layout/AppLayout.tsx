'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, loadFromStorage } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFromStorage();
    setLoading(false);
  }, [loadFromStorage]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
