'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { orgApi, slaApi, usersApi, authApi, jiraApi, categoriesApi, prioritiesApi, cannedResponsesApi, emailConfigApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, organization } = useAuthStore();
  const [activeTab, setActiveTab] = useState('org');
  const [orgForm, setOrgForm] = useState({ name: '', domain: '', logo: '' as string });
  const [slaPolicies, setSlaPolicies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: '', firstName: '', lastName: '', role: 'AGENT' });
  const [jiraForm, setJiraForm] = useState({ baseUrl: '', email: '', apiToken: '', projectKey: '', issueType: 'Task' });
  const [jiraConfigured, setJiraConfigured] = useState(false);
  const [jiraSaving, setJiraSaving] = useState(false);

  // Categories
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '', color: '#3b82f6' });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // Priorities
  const [priorities, setPriorities] = useState<any[]>([]);
  const [priorityForm, setPriorityForm] = useState({ name: '', level: 1, color: '#ef4444' });
  const [editingPriorityId, setEditingPriorityId] = useState<string | null>(null);

  // Canned Responses
  const [cannedResponses, setCannedResponses] = useState<any[]>([]);
  const [cannedForm, setCannedForm] = useState({ title: '', shortcut: '', content: '', category: '', isShared: false });
  const [editingCannedId, setEditingCannedId] = useState<string | null>(null);
  const [showCannedForm, setShowCannedForm] = useState(false);

  // Email Config
  const [emailForm, setEmailForm] = useState({
    smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', fromEmail: '', fromName: '',
    onTicketCreated: false, onTicketAssigned: false, onStatusChanged: false,
    onNewComment: false, onSlaBreach: false, onTicketResolved: false,
  });
  const [emailSaving, setEmailSaving] = useState(false);

  // Auto-Assign
  const [autoAssignMode, setAutoAssignMode] = useState('MANUAL');

  useEffect(() => {
    if (organization) {
      setOrgForm({ name: organization.name, domain: '', logo: organization.logo || '' });
    }
    slaApi.list().then((r) => setSlaPolicies(r.data)).catch(() => {});
    usersApi.list({ limit: 50 }).then((r) => setUsers(r.data.data)).catch(() => {});
    jiraApi.getConfig().then((r) => {
      if (r.data) {
        setJiraForm({ baseUrl: r.data.baseUrl, email: r.data.email, apiToken: '', projectKey: r.data.projectKey, issueType: r.data.issueType });
        setJiraConfigured(true);
      }
    }).catch(() => {});
    categoriesApi.list().then((r) => setCategories(r.data)).catch(() => {});
    prioritiesApi.list().then((r) => setPriorities(r.data)).catch(() => {});
    cannedResponsesApi.list().then((r) => setCannedResponses(r.data)).catch(() => {});
    emailConfigApi.get().then((r) => {
      if (r.data) setEmailForm((prev) => ({ ...prev, ...r.data }));
    }).catch(() => {});
    orgApi.getCurrent().then((r) => {
      if (r.data?.autoAssignMode) setAutoAssignMode(r.data.autoAssignMode);
    }).catch(() => {});
  }, [organization]);

  const handleOrgUpdate = async () => {
    try {
      await orgApi.update({ name: orgForm.name, domain: orgForm.domain, logo: orgForm.logo || null });
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

  // ── Category handlers ──
  const loadCategories = () => categoriesApi.list().then((r) => setCategories(r.data)).catch(() => {});
  const handleCategorySave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategoryId) {
        await categoriesApi.update(editingCategoryId, categoryForm);
        toast.success('Category updated');
      } else {
        await categoriesApi.create(categoryForm);
        toast.success('Category created');
      }
      setCategoryForm({ name: '', description: '', color: '#3b82f6' });
      setEditingCategoryId(null);
      loadCategories();
    } catch { toast.error('Failed to save category'); }
  };
  const handleCategoryEdit = (c: any) => {
    setCategoryForm({ name: c.name, description: c.description || '', color: c.color || '#3b82f6' });
    setEditingCategoryId(c.id);
  };
  const handleCategoryDelete = async (id: string) => {
    try { await categoriesApi.delete(id); toast.success('Category deleted'); loadCategories(); }
    catch { toast.error('Failed to delete category'); }
  };

  // ── Priority handlers ──
  const loadPriorities = () => prioritiesApi.list().then((r) => setPriorities(r.data)).catch(() => {});
  const handlePrioritySave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPriorityId) {
        await prioritiesApi.update(editingPriorityId, priorityForm);
        toast.success('Priority updated');
      } else {
        await prioritiesApi.create(priorityForm);
        toast.success('Priority created');
      }
      setPriorityForm({ name: '', level: 1, color: '#ef4444' });
      setEditingPriorityId(null);
      loadPriorities();
    } catch { toast.error('Failed to save priority'); }
  };
  const handlePriorityEdit = (p: any) => {
    setPriorityForm({ name: p.name, level: p.level, color: p.color || '#ef4444' });
    setEditingPriorityId(p.id);
  };
  const handlePriorityDelete = async (id: string) => {
    try { await prioritiesApi.delete(id); toast.success('Priority deleted'); loadPriorities(); }
    catch { toast.error('Failed to delete priority'); }
  };

  // ── Canned Response handlers ──
  const loadCanned = () => cannedResponsesApi.list().then((r) => setCannedResponses(r.data)).catch(() => {});
  const handleCannedSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCannedId) {
        await cannedResponsesApi.update(editingCannedId, cannedForm);
        toast.success('Response updated');
      } else {
        await cannedResponsesApi.create(cannedForm);
        toast.success('Response created');
      }
      setCannedForm({ title: '', shortcut: '', content: '', category: '', isShared: false });
      setEditingCannedId(null);
      setShowCannedForm(false);
      loadCanned();
    } catch { toast.error('Failed to save response'); }
  };
  const handleCannedEdit = (c: any) => {
    setCannedForm({ title: c.title, shortcut: c.shortcut || '', content: c.content, category: c.category || '', isShared: c.isShared || false });
    setEditingCannedId(c.id);
    setShowCannedForm(true);
  };
  const handleCannedDelete = async (id: string) => {
    try { await cannedResponsesApi.delete(id); toast.success('Response deleted'); loadCanned(); }
    catch { toast.error('Failed to delete response'); }
  };

  // ── Email Config handlers ──
  const handleEmailSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSaving(true);
    try {
      await emailConfigApi.save(emailForm);
      toast.success('Email configuration saved');
    } catch { toast.error('Failed to save email config'); }
    finally { setEmailSaving(false); }
  };
  const handleEmailTest = async () => {
    try { await emailConfigApi.test(); toast.success('Test email sent!'); }
    catch { toast.error('Failed to send test email'); }
  };

  // ── Auto-Assign handler ──
  const handleAutoAssignSave = async () => {
    try {
      await orgApi.update({ autoAssignMode });
      toast.success('Auto-assign mode updated');
    } catch { toast.error('Failed to update auto-assign'); }
  };

  const tabs = [
    { id: 'org', label: 'Organization' },
    { id: 'team', label: 'Team' },
    { id: 'sla', label: 'SLA Policies' },
    { id: 'jira', label: 'JIRA Integration' },
    { id: 'categories', label: 'Categories' },
    { id: 'priorities', label: 'Priorities' },
    { id: 'canned', label: 'Canned Responses' },
    { id: 'email', label: 'Email' },
    { id: 'autoassign', label: 'Auto-Assign' },
  ];

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
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
        <div className="space-y-6 max-w-xl">
          {/* Organization Logo */}
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Organization Logo</h3>
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
                {orgForm.logo ? (
                  <img src={orgForm.logo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-2xl font-bold text-gray-300 dark:text-gray-600">
                    {orgForm.name?.substring(0, 2).toUpperCase() || 'ORG'}
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  className="input text-sm"
                  placeholder="Paste logo URL (e.g., https://yoursite.com/logo.png)"
                  value={orgForm.logo || ''}
                  onChange={(e) => setOrgForm({ ...orgForm, logo: e.target.value })}
                />
                <p className="text-xs text-gray-400">Recommended: Square image, 128x128px or larger. PNG or SVG.</p>
                {orgForm.logo && (
                  <button
                    onClick={() => setOrgForm({ ...orgForm, logo: '' })}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Organization Details */}
          <div className="card p-6 space-y-4">
            <h3 className="font-semibold">Organization Details</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input className="input" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Domain</label>
              <input className="input" value={orgForm.domain} onChange={(e) => setOrgForm({ ...orgForm, domain: e.target.value })} placeholder="company.com" />
            </div>
            <button onClick={handleOrgUpdate} className="btn-primary">Save Changes</button>
          </div>
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
      {activeTab === 'categories' && (
        <div className="space-y-6 max-w-2xl">
          <div className="card p-6">
            <h3 className="font-semibold mb-4">{editingCategoryId ? 'Edit Category' : 'Add Category'}</h3>
            <form onSubmit={handleCategorySave} className="space-y-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input className="input" required placeholder="e.g. Billing" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Color</label>
                  <input type="color" className="w-10 h-10 rounded cursor-pointer border border-gray-300" value={categoryForm.color} onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input className="input" placeholder="Optional description" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary">{editingCategoryId ? 'Update' : 'Add Category'}</button>
                {editingCategoryId && (
                  <button type="button" className="btn-secondary" onClick={() => { setEditingCategoryId(null); setCategoryForm({ name: '', description: '', color: '#3b82f6' }); }}>Cancel</button>
                )}
              </div>
            </form>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {categories.map((c: any) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3"><span className="inline-block w-4 h-4 rounded-full" style={{ backgroundColor: c.color || '#3b82f6' }} /></td>
                    <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.description || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleCategoryEdit(c)} className="btn-secondary text-xs mr-2">Edit</button>
                      <button onClick={() => handleCategoryDelete(c.id)} className="btn-danger text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No categories yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'priorities' && (
        <div className="space-y-6 max-w-2xl">
          <div className="card p-6">
            <h3 className="font-semibold mb-4">{editingPriorityId ? 'Edit Priority' : 'Add Priority'}</h3>
            <form onSubmit={handlePrioritySave} className="space-y-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input className="input" required placeholder="e.g. Critical" value={priorityForm.name} onChange={(e) => setPriorityForm({ ...priorityForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Level</label>
                  <input type="number" className="input w-24" required min={1} value={priorityForm.level} onChange={(e) => setPriorityForm({ ...priorityForm, level: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Color</label>
                  <input type="color" className="w-10 h-10 rounded cursor-pointer border border-gray-300" value={priorityForm.color} onChange={(e) => setPriorityForm({ ...priorityForm, color: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary">{editingPriorityId ? 'Update' : 'Add Priority'}</button>
                {editingPriorityId && (
                  <button type="button" className="btn-secondary" onClick={() => { setEditingPriorityId(null); setPriorityForm({ name: '', level: 1, color: '#ef4444' }); }}>Cancel</button>
                )}
              </div>
            </form>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {priorities.map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3"><span className="inline-block w-4 h-4 rounded-full" style={{ backgroundColor: p.color || '#ef4444' }} /></td>
                    <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-sm">{p.level}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handlePriorityEdit(p)} className="btn-secondary text-xs mr-2">Edit</button>
                      <button onClick={() => handlePriorityDelete(p.id)} className="btn-danger text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
                {priorities.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No custom priorities yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'canned' && (
        <div className="space-y-6 max-w-3xl">
          {!showCannedForm && (
            <button onClick={() => { setShowCannedForm(true); setEditingCannedId(null); setCannedForm({ title: '', shortcut: '', content: '', category: '', isShared: false }); }} className="btn-primary">Add Response</button>
          )}

          {showCannedForm && (
            <div className="card p-6">
              <h3 className="font-semibold mb-4">{editingCannedId ? 'Edit Canned Response' : 'Add Canned Response'}</h3>
              <form onSubmit={handleCannedSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input className="input" required placeholder="e.g. Thank You" value={cannedForm.title} onChange={(e) => setCannedForm({ ...cannedForm, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Shortcut</label>
                    <input className="input" placeholder="/thanks" value={cannedForm.shortcut} onChange={(e) => setCannedForm({ ...cannedForm, shortcut: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Content</label>
                  <textarea className="input min-h-[100px]" required placeholder="Response content..." value={cannedForm.content} onChange={(e) => setCannedForm({ ...cannedForm, content: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block text-sm font-medium mb-1">Category Tag</label>
                    <input className="input" placeholder="e.g. greeting, closing" value={cannedForm.category} onChange={(e) => setCannedForm({ ...cannedForm, category: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="isShared" checked={cannedForm.isShared} onChange={(e) => setCannedForm({ ...cannedForm, isShared: e.target.checked })} className="rounded border-gray-300" />
                    <label htmlFor="isShared" className="text-sm font-medium">Shared with team</label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary">{editingCannedId ? 'Update' : 'Add Response'}</button>
                  <button type="button" className="btn-secondary" onClick={() => { setShowCannedForm(false); setEditingCannedId(null); setCannedForm({ title: '', shortcut: '', content: '', category: '', isShared: false }); }}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shortcut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {cannedResponses.map((c: any) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 text-sm font-medium">{c.title}</td>
                    <td className="px-4 py-3 text-sm"><code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{c.shortcut || '—'}</code></td>
                    <td className="px-4 py-3 text-sm">{c.category ? <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">{c.category}</span> : '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`badge ${c.isShared ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {c.isShared ? 'Shared' : 'Personal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleCannedEdit(c)} className="btn-secondary text-xs mr-2">Edit</button>
                      <button onClick={() => handleCannedDelete(c.id)} className="btn-danger text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
                {cannedResponses.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No canned responses yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div className="space-y-6 max-w-xl">
          <div className="card p-6">
            <h3 className="font-semibold mb-4">SMTP Configuration</h3>
            <form onSubmit={handleEmailSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">SMTP Host</label>
                  <input className="input" placeholder="smtp.gmail.com" value={emailForm.smtpHost} onChange={(e) => setEmailForm({ ...emailForm, smtpHost: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SMTP Port</label>
                  <input type="number" className="input" placeholder="587" value={emailForm.smtpPort} onChange={(e) => setEmailForm({ ...emailForm, smtpPort: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">SMTP User</label>
                  <input className="input" placeholder="user@gmail.com" value={emailForm.smtpUser} onChange={(e) => setEmailForm({ ...emailForm, smtpUser: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">SMTP Password</label>
                  <input type="password" className="input" placeholder="App password" value={emailForm.smtpPass} onChange={(e) => setEmailForm({ ...emailForm, smtpPass: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">From Email</label>
                  <input type="email" className="input" placeholder="support@company.com" value={emailForm.fromEmail} onChange={(e) => setEmailForm({ ...emailForm, fromEmail: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">From Name</label>
                  <input className="input" placeholder="Support Team" value={emailForm.fromName} onChange={(e) => setEmailForm({ ...emailForm, fromName: e.target.value })} />
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 pt-4 mt-4">
                <h4 className="text-sm font-semibold mb-3">Notification Triggers</h4>
                <div className="space-y-3">
                  {([
                    ['onTicketCreated', 'Ticket Created'],
                    ['onTicketAssigned', 'Ticket Assigned'],
                    ['onStatusChanged', 'Status Changed'],
                    ['onNewComment', 'New Comment'],
                    ['onSlaBreach', 'SLA Breach'],
                    ['onTicketResolved', 'Ticket Resolved'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between">
                      <span className="text-sm">{label}</span>
                      <button
                        type="button"
                        onClick={() => setEmailForm({ ...emailForm, [key]: !emailForm[key as keyof typeof emailForm] })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emailForm[key as keyof typeof emailForm] ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${emailForm[key as keyof typeof emailForm] ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary" disabled={emailSaving}>{emailSaving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={handleEmailTest} className="btn-secondary">Send Test Email</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'autoassign' && (
        <div className="space-y-6 max-w-xl">
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Auto-Assign Mode</h3>
            <p className="text-sm text-gray-500 mb-4">Choose how new tickets are automatically assigned to agents.</p>
            <div className="space-y-4">
              {([
                { value: 'MANUAL', title: 'Manual', desc: 'Tickets are not automatically assigned. Admins or agents pick up tickets manually.' },
                { value: 'ROUND_ROBIN', title: 'Round Robin', desc: 'Tickets are assigned to agents in rotation, distributing work evenly in order.' },
                { value: 'LOAD_BALANCED', title: 'Load Balanced', desc: 'Tickets are assigned to the agent with the fewest open tickets, balancing workload.' },
              ]).map((mode) => (
                <label key={mode.value} className={`block p-4 rounded-lg border-2 cursor-pointer transition-colors ${autoAssignMode === mode.value ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="autoAssign" value={mode.value} checked={autoAssignMode === mode.value} onChange={(e) => setAutoAssignMode(e.target.value)} className="text-primary-600" />
                    <div>
                      <div className="font-medium text-sm">{mode.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{mode.desc}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <button onClick={handleAutoAssignSave} className="btn-primary mt-4">Save</button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
