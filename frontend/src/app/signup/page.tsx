'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import toast from 'react-hot-toast';
import { TicketIcon } from '@heroicons/react/24/outline';

export default function SignupPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    organizationName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.signup(form);
      setAuth(data.user, data.organization, data.accessToken, data.refreshToken);
      toast.success('Organization created successfully!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Signup failed');
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
          <h2 className="text-xl font-semibold mb-6">Create your organization</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Organization Name</label>
              <input
                type="text"
                className="input"
                placeholder="My Company"
                value={form.organizationName}
                onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">First Name</label>
                <input
                  type="text"
                  className="input"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Last Name</label>
                <input
                  type="text"
                  className="input"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                />
              </div>
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
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Organization'}
            </button>
          </form>

          <p className="text-sm text-center mt-6 text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-primary-600 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
