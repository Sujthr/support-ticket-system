'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import toast from 'react-hot-toast';
import { TicketIcon } from '@heroicons/react/24/outline';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    organizationSlug: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.login(form);
      setAuth(data.user, data.organization, data.accessToken, data.refreshToken);
      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
            <TicketIcon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold">SupportDesk</h1>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Organization Slug</label>
              <input
                type="text"
                className="input"
                placeholder="my-company"
                value={form.organizationSlug}
                onChange={(e) => setForm({ ...form, organizationSlug: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-sm text-center mt-6 text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary-600 hover:underline font-medium">
              Create organization
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
