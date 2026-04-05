'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { kbApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { timeAgo } from '@/lib/utils';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function KnowledgeBasePage() {
  const { user } = useAuthStore();
  const isAgent = user?.role === 'ADMIN' || user?.role === 'AGENT';
  const [categories, setCategories] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showCreateArticle, setShowCreateArticle] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create article form
  const [articleForm, setArticleForm] = useState({
    title: '', content: '', categoryId: '', isPublished: true,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, artRes] = await Promise.all([
        kbApi.getCategories(),
        kbApi.getArticles({
          search: search || undefined,
          categoryId: selectedCategory || undefined,
          publishedOnly: isAgent ? undefined : 'true',
        }),
      ]);
      setCategories(catRes.data);
      setArticles(artRes.data.data);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [search, selectedCategory]);

  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await kbApi.createArticle(articleForm);
      toast.success('Article created');
      setShowCreateArticle(false);
      setArticleForm({ title: '', content: '', categoryId: '', isPublished: true });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create article');
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-gray-500 text-sm mt-1">Help articles and documentation</p>
        </div>
        {isAgent && (
          <button onClick={() => setShowCreateArticle(true)} className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-4 h-4" /> New Article
          </button>
        )}
      </div>

      {/* Search and filter */}
      <div className="card p-4 mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            className="input pl-10"
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input max-w-[200px]"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c._count?.articles || 0})</option>
          ))}
        </select>
      </div>

      {/* Articles */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : articles.length === 0 ? (
        <div className="card py-20 text-center text-gray-500">
          <p className="text-lg">No articles found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {articles.map((article: any) => (
            <div key={article.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{article.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                    {article.content.substring(0, 200)}...
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-400">
                      {article.category?.name}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(article.updatedAt)}</span>
                    {!article.isPublished && (
                      <span className="text-xs text-yellow-600 font-medium">Draft</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Article Modal */}
      {showCreateArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-semibold">New Article</h2>
              <button onClick={() => setShowCreateArticle(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreateArticle} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text" className="input" required
                  value={articleForm.title}
                  onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  className="input" required
                  value={articleForm.categoryId}
                  onChange={(e) => setArticleForm({ ...articleForm, categoryId: e.target.value })}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Content</label>
                <textarea
                  className="input min-h-[200px]" required
                  value={articleForm.content}
                  onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={articleForm.isPublished}
                  onChange={(e) => setArticleForm({ ...articleForm, isPublished: e.target.checked })}
                />
                <span className="text-sm">Publish immediately</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateArticle(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create Article</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
