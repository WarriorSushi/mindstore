'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileStack, ArrowLeft, Settings2, RefreshCw, Database, CheckCircle, XCircle,
  AlertTriangle, Loader2, Link2, Unlink, ChevronDown, ChevronRight, Clock,
  Filter, Zap, History, ArrowUpRight, Eye, Plus, Trash2, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

interface SyncConfig {
  connected: boolean;
  databaseId: string | null;
  databaseName: string | null;
  syncDirection: string;
  autoSync: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
  lastSyncCount: number;
  totalSynced: number;
  filterBySource: string[];
  databases: Array<{ id: string; title: string }>;
}

interface SyncRecord {
  id: string;
  timestamp: string;
  direction: string;
  count: number;
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
}

interface PreviewData {
  totalMemories: number;
  unsyncedCount: number;
  syncedCount: number;
  sourceBreakdown: Record<string, number>;
  sample: Array<{ id: number; title: string; sourceType: string; createdAt: string; preview: string }>;
}

export default function NotionSyncPage() {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [history, setHistory] = useState<SyncRecord[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [validating, setValidating] = useState(false);
  const [creatingDb, setCreatingDb] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const [configRes, historyRes, previewRes] = await Promise.all([
        fetch('/api/v1/plugins/notion-sync?action=config'),
        fetch('/api/v1/plugins/notion-sync?action=history'),
        fetch('/api/v1/plugins/notion-sync?action=preview'),
      ]);
      const configData = await configRes.json();
      const historyData = await historyRes.json();
      const previewData = await previewRes.json();
      setConfig(configData);
      setHistory(historyData.history || []);
      setPreview(previewData);
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;
    setValidating(true);
    try {
      const res = await fetch('/api/v1/plugins/notion-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', token: tokenInput }),
      });
      const data = await res.json();
      if (data.valid) {
        // Save token
        await fetch('/api/v1/plugins/notion-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save-config', token: tokenInput }),
        });
        toast.success('Connected to Notion!');
        setShowConnect(false);
        setTokenInput('');
        fetchConfig();
      } else {
        toast.error(`Invalid token: ${data.error}`);
      }
    } catch {
      toast.error('Connection failed');
    } finally {
      setValidating(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/v1/plugins/notion-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      toast.success('Disconnected from Notion');
      fetchConfig();
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const handleSelectDatabase = async (id: string, name: string) => {
    try {
      await fetch('/api/v1/plugins/notion-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-config', databaseId: id, databaseName: name }),
      });
      toast.success(`Selected database: ${name}`);
      fetchConfig();
    } catch {
      toast.error('Failed to select database');
    }
  };

  const handleCreateDatabase = async () => {
    setCreatingDb(true);
    try {
      const res = await fetch('/api/v1/plugins/notion-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-database' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Created MindStore database in Notion!');
        fetchConfig();
      } else {
        toast.error(data.error || 'Failed to create database');
      }
    } catch {
      toast.error('Failed to create database');
    } finally {
      setCreatingDb(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/v1/plugins/notion-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await res.json();
      if (data.success) {
        const msg = data.errors > 0
          ? `Synced ${data.synced} memories (${data.errors} errors)`
          : `Synced ${data.synced} memories to Notion!`;
        toast.success(msg);
        if (data.remaining > 0) {
          toast.info(`${data.remaining} more memories remaining. Run sync again.`);
        }
        fetchConfig();
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
        <p className="text-sm text-zinc-500">Loading Notion sync...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => window.history.back()} className="p-1.5 rounded-lg hover:bg-white/[0.04] text-zinc-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center">
          <FileStack className="w-4.5 h-4.5 text-teal-400" />
        </div>
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.03em]">Notion Sync</h1>
          <p className="text-xs text-zinc-500">Push your MindStore knowledge to a Notion database</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${config?.connected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            <span className="text-sm font-medium">{config?.connected ? 'Connected to Notion' : 'Not Connected'}</span>
          </div>
          {config?.connected ? (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
            >
              <Unlink className="w-3 h-3" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => setShowConnect(!showConnect)}
              className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 transition-colors"
            >
              <Link2 className="w-3 h-3" />
              Connect
            </button>
          )}
        </div>

        {/* Connect form */}
        {showConnect && !config?.connected && (
          <div className="pt-3 border-t border-white/[0.06]">
            <p className="text-xs text-zinc-500 mb-3">
              Create an integration at{' '}
              <a href="https://www.notion.so/my-integrations" target="_blank" className="text-teal-400 hover:underline">
                notion.so/my-integrations
              </a>
              , then paste the token below.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="ntn_..."
                className="flex-1 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500/30"
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
              />
              <button
                onClick={handleConnect}
                disabled={validating || !tokenInput.trim()}
                className="h-9 px-4 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Validate
              </button>
            </div>
          </div>
        )}

        {/* Database selector */}
        {config?.connected && (
          <div className="pt-3 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500">Target Database</span>
              {!config.databaseId && (
                <button
                  onClick={handleCreateDatabase}
                  disabled={creatingDb}
                  className="flex items-center gap-1 px-2 h-6 rounded text-[10px] text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 transition-colors"
                >
                  {creatingDb ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Create New
                </button>
              )}
            </div>
            
            {config.databaseId ? (
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-teal-400" />
                <span className="text-sm">{config.databaseName || 'Selected Database'}</span>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
              </div>
            ) : config.databases.length > 0 ? (
              <div className="space-y-1.5">
                {config.databases.slice(0, 6).map(db => (
                  <button
                    key={db.id}
                    onClick={() => handleSelectDatabase(db.id, db.title)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-white/[0.04] transition-colors"
                  >
                    <Database className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{db.title}</span>
                    <ArrowUpRight className="w-3 h-3 text-zinc-600 ml-auto" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-600">No databases found. Create one or share an existing database with your integration.</p>
            )}
          </div>
        )}
      </div>

      {/* Sync Stats */}
      {config?.connected && config.databaseId && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Total Synced', value: config.totalSynced || 0, icon: CheckCircle, color: 'text-emerald-400' },
              { label: 'Unsynced', value: preview?.unsyncedCount || 0, icon: AlertTriangle, color: 'text-amber-400' },
              { label: 'Total Memories', value: preview?.totalMemories || 0, icon: Database, color: 'text-teal-400' },
              { label: 'Last Sync', value: config.lastSyncAt ? formatTime(config.lastSyncAt) : 'Never', icon: Clock, color: 'text-sky-400' },
            ].map((stat, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
                <div className="text-lg font-semibold tabular-nums">{stat.value}</div>
                <div className="text-[10px] text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Source Breakdown */}
          {preview && Object.keys(preview.sourceBreakdown).length > 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-4">
              <h3 className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                Unsynced by Source
              </h3>
              <div className="space-y-1.5">
                {Object.entries(preview.sourceBreakdown).sort((a, b) => b[1] - a[1]).map(([source, count]) => {
                  const total = preview.unsyncedCount || 1;
                  return (
                    <div key={source} className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400 w-20 truncate capitalize">{source}</span>
                      <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500/50 rounded-full" style={{ width: `${(count / total) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-zinc-500 tabular-nums w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sync Button */}
          <button
            onClick={handleSync}
            disabled={syncing || !preview?.unsyncedCount}
            className="w-full h-11 rounded-xl text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-2 mb-4"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing to Notion...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Sync {preview?.unsyncedCount || 0} memories to Notion
              </>
            )}
          </button>

          {/* Preview Sample */}
          {preview && preview.sample.length > 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-4">
              <h3 className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Next to Sync
              </h3>
              <div className="space-y-2">
                {preview.sample.map(item => (
                  <div key={item.id} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 capitalize">{item.sourceType}</span>
                      <span className="text-xs text-zinc-300 truncate flex-1">{item.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 line-clamp-1">{item.preview}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync History */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center gap-1.5 text-xs font-medium text-zinc-400"
            >
              <History className="w-3.5 h-3.5" />
              Sync History
              {showHistory ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
            </button>
            
            {showHistory && (
              <div className="mt-3 space-y-1.5">
                {history.length === 0 ? (
                  <p className="text-xs text-zinc-600 py-2">No sync history yet</p>
                ) : history.map(record => (
                  <div key={record.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02]">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      record.status === 'success' ? 'bg-emerald-400' :
                      record.status === 'partial' ? 'bg-amber-400' : 'bg-rose-400'
                    }`} />
                    <span className="text-xs text-zinc-400">
                      {record.direction === 'push' ? '↑' : '↓'} {record.count} memories
                    </span>
                    <span className="text-[10px] text-zinc-600 ml-auto">{formatTime(record.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Not connected empty state */}
      {!config?.connected && !showConnect && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
            <FileStack className="w-6 h-6 text-zinc-500" />
          </div>
          <h3 className="text-sm font-medium text-zinc-300 mb-1">Connect Notion</h3>
          <p className="text-xs text-zinc-500 max-w-sm mb-4">
            Push your MindStore memories to a Notion database. Searchable, organized, and always in sync.
          </p>
          <button
            onClick={() => setShowConnect(true)}
            className="px-4 h-9 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white transition-colors flex items-center gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5" />
            Connect Notion
          </button>
        </div>
      )}
    </div>
  );
}
