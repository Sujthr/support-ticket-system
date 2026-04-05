'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { orgApi, slaApi, usersApi, authApi, jiraApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, organization } = useAuthStore();
  const [activeTab, setActiveTab] = useState('org');
  const [orgForm, setOrgForm] = useState({ name: '', domain: '' });
  const [slaPolicies, setSlaPolicies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: '', firstName: '', lastName: '', role: 'AGENT' });
  const [jiraForm, setJiraForm] = useState({ baseUrl: '', email: '', apiToken: '', projectKey: '', issueType: 'Task' });
  const [jiraConfigured, setJiraConfigured] = useState(false);
  const [jiraSaving, setJiraSaving] = useState(false);

  useEffect(() => {
    if (organization) {
      setOrgForm({ name: organization.name, domain: '' });
    }
    slaApi.list().then((r) => setSlaPolicies(r.data)).catch(() => {});
    usersApi.list({ limit: 50 }).then((r) => setUsers(r.data.data)).catch(() => {});
    jiraApi.getConfig().then((r) => {
      if (r.data) {
        setJiraForm({ baseUrl: r.data.baseUrl, email: r.data.email, apiToken: '', projectKey: r.data.projectKey, issueType: r.data.issueType });
        setJiraConfigured(true);
      }
    }).catch(() => {});
  }, [organization]);

  const handleOrgUpdate = async () => {
    try {
      await orgApi.update(orgForm);
      toast.success('Organization updated');
    } catch { toast.error('Failed to update'); }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await authApi.invite(inviteForm);
      toast.success(`Invited! Temp password: ${data.temporaryPassword}`);
      setInviteForm({ email: '', firstName: '', lastName: '', role: 'AGENT' });
      usersApi.list({ limit: 50 }).then((r) => setUsers(r.data.data)).catch(() => {});
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to invite');
    }
  };

  const handleJiraSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setJiraSaving(true);
    try {
      await jiraApi.saveConfig(jiraForm);
      toast.success('JIRA configuration saved and verified!');
      setJiraConfigured(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save JIRA config');
    } finally {
      setJiraSaving(false);
    }
  };

  const handleJiraDelete = async () => {
    try {
      await jiraApi.deleteConfig();
      setJiraForm({ baseUrl: '', email: '', apiToken: '', projectKey: '', issueType: 'Task' });
      setJiraConfigured(false);
      toast.success('JIRA configuration removed');
    } catch { toast.error('Failed to remove config'); }
  };

  const tabs = [
    { id: 'org', label: 'Organization' },
    { id: 'team', label: 'Team' },
    { id: 'sla', label: 'SLA Policies' },
    { id: 'jira', label: 'JIRA Integration' },
  ];

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'org' && (
        <div className="card p-6 max-w-xl space-y-4">
          <h3 className="font-semibold">Organization Settings</h3>
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input className="input" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Domain</label>
            <input className="input" value={orgForm.domain} onChange={(e) => setOrgForm({ ...orgForm, domain: e.target.value })} placeholder="company.com" />
          </div>
          <button onClick={handleOrgUpdate} className="btn-primary">Save</button>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="card p-6 max-w-xl">
            <h3 className="font-semibold mb-4">Invite Team Member</h3>
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="First name" required value={inviteForm.firstName} onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })} />
                <input className="input" placeholder="Last name" required value={inviteForm.lastName} onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })} />
              </div>
              <input className="input" type="email" placeholder="Email" required value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
              <select className="input" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}>
                <option value="AGENT">Agent</option>
                <option value="ADMIN">Admin</option>
                <option value="END_USER">End User</option>
              </select>
              <button type="submit" className="btn-primary">Send Invite</button>
            </form>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {users.map((u: any) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 text-sm font-medium">{u.firstName} {u.lastName}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                    <td className="px-4 py-3"><span className="badge bg-primary-50 text-primary-600">{u.role}</span></td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sla' && (
        <div className="card overflow-hidden max-w-2xl">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Response</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resolution</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {slaPolicies.map((p: any) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-sm font-medium">{p.priority}</td>
                  <td className="px-4 py-3 text-sm">{p.firstResponseMinutes} min</td>
                  <td className="px-4 py-3 text-sm">{p.resolutionMinutes} min</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.isActive ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'jira' && (
        <div className="space-y-6 max-w-xl">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.004 0c-1.532 6.636-5.368 10.472-12.004 12.004 6.636 1.532 10.472 5.368 12.004 12.004 1.532-6.636 5.368-10.472 12.004-12.004-6.636-1.532-10.472-5.368-12.004-12.004z"/>
              </svg>
              <div>
                <h3 className="font-semibold">JIRA Integration</h3>
                <p className="text-sm text-gray-500">Connect to JIRA to create dev tickets from support issues</p>
              </div>
              {jiraConfigured && (
                <span className="ml-auto badge bg-green-100 text-green-700">Connected</span>
              )}
            </div>

            <form onSubmit={handleJiraSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">JIRA Base URL</label>
                <input
                  className="input" required
                  placeholder="https://yourcompany.atlassian.net"
                  value={jiraForm.baseUrl}
                  onChange={(e) => setJiraForm({ ...jiraForm, baseUrl: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">JIRA Email</label>
                <input
                  className="input" type="email" required
                  placeholder="you@company.com"
                  value={jiraForm.email}
                  onChange={(e) => setJiraForm({ ...jiraForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">API Token</label>
                <input
                  className="input" type="password" required={!jiraConfigured}
                  placeholder={jiraConfigured ? 'Leave blank to keep existing' : 'Paste your JIRA API token'}
                  value={jiraForm.apiToken}
                  onChange={(e) => setJiraForm({ ...jiraForm, apiToken: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Generate at: Settings &gt; Atlassian Account &gt; Security &gt; API Tokens
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Project Key</label>
                  <input
                    className="input" required
                    placeholder="DEV"
                    value={jiraForm.projectKey}
                    onChange={(e) => setJiraForm({ ...jiraForm, projectKey: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Issue Type</label>
                  <select
                    className="input"
                    value={jiraForm.issueType}
                    onChange={(e) => setJiraForm({ ...jiraForm, issueType: e.target.value })}
                  >
                    <option value="Task">Task</option>
                    <option value="Bug">Bug</option>
                    <option value="Story">Story</option>
                    <option value="Epic">Epic</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary" disabled={jiraSaving}>
                  {jiraSaving ? 'Verifying & Saving...' : jiraConfigured ? 'Update Config' : 'Connect JIRA'}
                </button>
                {jiraConfigured && (
                  <button type="button" onClick={handleJiraDelete} className="btn-danger">
                    Disconnect
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-2">How it works</h3>
            <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
              <li>Configure your JIRA credentials above</li>
              <li>Open any support ticket that needs dev work</li>
              <li>Click <strong>&quot;Create JIRA Ticket&quot;</strong> in the ticket sidebar</li>
              <li>A JIRA issue is created with ticket details auto-filled</li>
              <li>The support ticket shows the linked JIRA issue with live status sync</li>
            </ol>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
