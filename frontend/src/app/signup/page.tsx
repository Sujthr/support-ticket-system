'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { getCopyrightText } from '@/lib/branding';
import BrandLogo from '@/components/common/BrandLogo';
import toast from 'react-hot-toast';

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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="flex justify-center mb-8">
            <BrandLogo size="lg" />
          </div>

          {/* Card */}
          <div className="card p-8 shadow-lg">
            <h2 className="text-xl font-semibold mb-1">Get started</h2>
            <p className="text-sm text-gray-500 mb-6">Create your organization and admin account</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Organization Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Acme Corp"
                  value={form.organizationName}
                  onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">First Name</label>
                  <input
                    type="text"
                    className="input"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Last Name</label>
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
                <label className="block text-sm font-medium mb-1.5">Email</label>
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
                <label className="block text-sm font-medium mb-1.5">Password</label>
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
              <button
                type="submit"
                className="btn-primary w-full py-2.5 text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Creating...
                  </span>
                ) : 'Create Organization'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
              <p className="text-sm text-center text-gray-500">
                Already have an account?{' '}
                <Link href="/login" className="text-primary-600 hover:underline font-semibold">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 text-center">
        <p className="text-xs text-gray-400">{getCopyrightText()}</p>
      </div>
    </div>
  );
}
