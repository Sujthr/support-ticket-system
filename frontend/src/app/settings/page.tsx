'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { orgApi, slaApi, usersApi, authApi, jiraApi, categoriesApi, prioritiesApi, cannedResponsesApi, emailConfigApi, channelsApi } from '@/lib/api';
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

  // Channel Config
  const [channelForm, setChannelForm] = useState({
    imapEnabled: false, imapHost: '', imapPort: 993, imapUser: '', imapPass: '', imapTls: true,
    twilioEnabled: false, twilioAccountSid: '', twilioAuthToken: '', twilioPhoneNumber: '', twilioRecordCalls: false,
    metaWhatsappEnabled: false, metaWhatsappToken: '', metaWhatsappPhoneId: '', metaWhatsappVerifyToken: '', metaWhatsappBusinessId: '',
    autoReplyEnabled: true, deduplicateMinutes: 30,
  });
  const [channelSaving, setChannelSaving] = useState(false);
  const [channelTestResult, setChannelTestResult] = useState<{ success: boolean; message: string } | null>(null);

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
    channelsApi.getConfig().then((r) => {
      if (r.data) setChannelForm((prev) => ({ ...prev, ...r.data }));
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

  // ── Channel Config handlers ──
  const handleChannelSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setChannelSaving(true);
    try {
      const { data } = await channelsApi.saveConfig(channelForm);
      setChannelForm((prev) => ({ ...prev, ...data }));
      toast.success('Channel configuration saved');
    } catch { toast.error('Failed to save channel config'); }
    finally { setChannelSaving(false); }
  };
  const handleImapTest = async () => {
    setChannelTestResult(null);
    try {
      const { data } = await channelsApi.testImap({
        imapHost: channelForm.imapHost,
        imapPort: channelForm.imapPort,
        imapUser: channelForm.imapUser,
        imapPass: channelForm.imapPass,
        imapTls: channelForm.imapTls,
      });
      setChannelTestResult(data);
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    } catch { toast.error('Failed to test IMAP connection'); }
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
    { id: 'channels', label: 'Channels' },
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

      {activeTab === 'channels' && (
        <div className="space-y-6 max-w-2xl">
          <form onSubmit={handleChannelSave} className="space-y-6">

            {/* ── Inbound Email (IMAP) ── */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-semibold">Inbound Email (IMAP)</h3>
                    <p className="text-xs text-gray-500">Polls a mailbox for new emails and creates tickets automatically</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChannelForm({ ...channelForm, imapEnabled: !channelForm.imapEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${channelForm.imapEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${channelForm.imapEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {channelForm.imapEnabled && (
                <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">IMAP Host</label>
                      <input className="input" placeholder="imap.gmail.com" value={channelForm.imapHost} onChange={(e) => setChannelForm({ ...channelForm, imapHost: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">IMAP Port</label>
                      <input type="number" className="input" value={channelForm.imapPort} onChange={(e) => setChannelForm({ ...channelForm, imapPort: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Username / Email</label>
                      <input className="input" placeholder="support@company.com" value={channelForm.imapUser} onChange={(e) => setChannelForm({ ...channelForm, imapUser: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Password / App Password</label>
                      <input type="password" className="input" value={channelForm.imapPass} onChange={(e) => setChannelForm({ ...channelForm, imapPass: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={channelForm.imapTls} onChange={(e) => setChannelForm({ ...channelForm, imapTls: e.target.checked })} className="rounded border-gray-300" />
                      <span className="text-sm">Use TLS/SSL</span>
                    </label>
                    <button type="button" onClick={handleImapTest} className="btn-secondary text-xs">Test Connection</button>
                  </div>
                  {channelTestResult && (
                    <div className={`text-sm p-2 rounded ${channelTestResult.success ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                      {channelTestResult.message}
                    </div>
                  )}
                  <p className="text-xs text-gray-400">For Gmail: use imap.gmail.com:993, enable IMAP in Gmail settings, and use an App Password.</p>
                </div>
              )}
            </div>

            {/* ── Twilio (Voice + WhatsApp) ── */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-semibold">Twilio (Voice + WhatsApp)</h3>
                    <p className="text-xs text-gray-500">Phone calls and WhatsApp messages via Twilio or SignalWire</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChannelForm({ ...channelForm, twilioEnabled: !channelForm.twilioEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${channelForm.twilioEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${channelForm.twilioEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {channelForm.twilioEnabled && (
                <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Account SID</label>
                      <input className="input" placeholder="ACxxxxxxxx" value={channelForm.twilioAccountSid} onChange={(e) => setChannelForm({ ...channelForm, twilioAccountSid: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Auth Token</label>
                      <input type="password" className="input" value={channelForm.twilioAuthToken} onChange={(e) => setChannelForm({ ...channelForm, twilioAuthToken: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone Number</label>
                    <input className="input" placeholder="+1234567890" value={channelForm.twilioPhoneNumber} onChange={(e) => setChannelForm({ ...channelForm, twilioPhoneNumber: e.target.value })} />
                    <p className="text-xs text-gray-400 mt-1">Your Twilio phone number (with country code). Used for both voice and WhatsApp.</p>
                  </div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={channelForm.twilioRecordCalls} onChange={(e) => setChannelForm({ ...channelForm, twilioRecordCalls: e.target.checked })} className="rounded border-gray-300" />
                    <span className="text-sm">Record calls and transcribe voicemails</span>
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                    <p className="font-medium text-gray-700 dark:text-gray-300">Webhook URLs (set these in your Twilio console):</p>
                    <p>Voice: <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/webhooks/twilio/voice</code></p>
                    <p>WhatsApp: <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/webhooks/twilio/whatsapp</code></p>
                    <p>Status Callback: <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/webhooks/twilio/voice/status</code></p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Meta WhatsApp Cloud API ── */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.496A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.342 0-4.542-.637-6.432-1.748l-.446-.268-2.637.884.884-2.637-.268-.447A9.955 9.955 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-semibold">Meta WhatsApp Cloud API</h3>
                    <p className="text-xs text-gray-500">Direct WhatsApp integration via Meta (free 1,000 conversations/month)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChannelForm({ ...channelForm, metaWhatsappEnabled: !channelForm.metaWhatsappEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${channelForm.metaWhatsappEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${channelForm.metaWhatsappEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {channelForm.metaWhatsappEnabled && (
                <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Access Token</label>
                      <input type="password" className="input" value={channelForm.metaWhatsappToken} onChange={(e) => setChannelForm({ ...channelForm, metaWhatsappToken: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone Number ID</label>
                      <input className="input" placeholder="From Meta Business dashboard" value={channelForm.metaWhatsappPhoneId} onChange={(e) => setChannelForm({ ...channelForm, metaWhatsappPhoneId: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Verify Token</label>
                      <input className="input" placeholder="Your custom verify token" value={channelForm.metaWhatsappVerifyToken} onChange={(e) => setChannelForm({ ...channelForm, metaWhatsappVerifyToken: e.target.value })} />
                      <p className="text-xs text-gray-400 mt-1">Set any string here and use the same in Meta webhook config.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Business Account ID</label>
                      <input className="input" placeholder="Optional" value={channelForm.metaWhatsappBusinessId} onChange={(e) => setChannelForm({ ...channelForm, metaWhatsappBusinessId: e.target.value })} />
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                    <p className="font-medium text-gray-700 dark:text-gray-300">Webhook URL (set in Meta Developers console):</p>
                    <p><code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/webhooks/meta/whatsapp</code></p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Common Settings ── */}
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Common Channel Settings</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">Auto-reply to senders</span>
                    <p className="text-xs text-gray-500">Send confirmation with ticket number back to the sender</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChannelForm({ ...channelForm, autoReplyEnabled: !channelForm.autoReplyEnabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${channelForm.autoReplyEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${channelForm.autoReplyEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>
                <div>
                  <label className="block text-sm font-medium mb-1">Deduplication Window (minutes)</label>
                  <input type="number" className="input w-32" min={0} max={1440} value={channelForm.deduplicateMinutes} onChange={(e) => setChannelForm({ ...channelForm, deduplicateMinutes: Number(e.target.value) })} />
                  <p className="text-xs text-gray-400 mt-1">Messages from the same sender within this window are added as comments to the existing ticket instead of creating a new one. Set to 0 to disable.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={channelSaving}>{channelSaving ? 'Saving...' : 'Save All Channel Settings'}</button>
            </div>
          </form>

          {/* How it works */}
          <div className="card p-6">
            <h3 className="font-semibold mb-2">How Channels Work</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-3">
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">Inbound Email</p>
                <p>The system polls your IMAP mailbox every minute. New unread emails are converted into tickets and marked as read. Free — works with any email provider (Gmail, Outlook, etc).</p>
              </div>
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">Phone Calls (Twilio/SignalWire)</p>
                <p>When someone calls your support number, a ticket is automatically created. Optionally records voicemail with transcription. Configure webhook URLs in your Twilio/SignalWire dashboard.</p>
              </div>
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">WhatsApp</p>
                <p>Supports both Twilio WhatsApp and Meta Cloud API (free tier: 1,000 conversations/month). Messages create tickets; follow-ups within the deduplication window are added as comments.</p>
              </div>
            </div>
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
