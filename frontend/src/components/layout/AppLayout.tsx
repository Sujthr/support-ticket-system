'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import BrandLogo from '@/components/common/BrandLogo';

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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <BrandLogo size="lg" />
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Sidebar />
      <div className="ml-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
