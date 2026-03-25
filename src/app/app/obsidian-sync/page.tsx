'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Gem, Download, Settings2, Loader2, FolderTree, FileText,
  CheckCircle, ChevronDown, ChevronRight, History, Eye, RefreshCw,
  Tag, Link2, Code, Clock, Hash, BookOpen, Layers
} from 'lucide-react';
import { toast } from 'sonner';

interface SyncConfig {
  vaultName: string;
  folderStructure: 'flat' | 'by-source' | 'by-date' | 'by-topic';
  includeMetadata: boolean;
  includeTags: boolean;
  includeBacklinks: boolean;
  includeWikilinks: boolean;
  frontmatterStyle: 'yaml' | 'none';
  filterBySource?: string[];
  lastExportAt?: string;
  exportCount?: number;
  syncHistory?: Array<{ id: string; timestamp: string; direction: string; count: number; status: string }>;
}

interface PreviewData {
  totalMemories: number;
  filteredCount: number;
  sourceBreakdown: Record<string, number>;
  folders: Record<string, number>;
  totalWords: number;
  sample: Array<{ id: number; name: string; path: string; sourceType: string; folder: string }>;
}

const FOLDER_OPTIONS = [
  { value: 'flat', label: 'Flat', desc: 'All notes in root' },
  { value: 'by-source', label: 'By Source', desc: 'ChatGPT/, Files/, URLs/...' },
  { value: 'by-date', label: 'By Date', desc: '2024/2024-03/...' },
];

export default function ObsidianSyncPage() {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [configRes, previewRes] = await Promise.all([
        fetch('/api/v1/plugins/obsidian-sync?action=config'),
        fetch('/api/v1/plugins/obsidian-sync?action=preview'),
      ]);
      const configData = await configRes.json();
      const previewData = await previewRes.json();
      setConfig(configData);
      setPreview(previewData);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveConfig = async (updates: Partial<SyncConfig>) => {
    setSaving(true);
    try {
      await fetch('/api/v1/plugins/obsidian-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-config', ...updates }),
      });
      toast.success('Settings saved');
      fetchData();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/v1/plugins/obsidian-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config?.vaultName || 'MindStore'}-vault.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${preview?.filteredCount || 0} memories as Obsidian vault`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
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
        <p className="text-sm text-zinc-500">Loading vault sync...</p>
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
          <Gem className="w-4.5 h-4.5 text-teal-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-[22px] font-semibold tracking-[-0.03em]">Obsidian Vault Sync</h1>
          <p className="text-xs text-zinc-500">Export your knowledge as an Obsidian vault</p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-lg hover:bg-white/[0.04] text-zinc-500 transition-colors"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Notes', value: preview?.filteredCount || 0, icon: FileText, color: 'text-teal-400' },
          { label: 'Words', value: preview?.totalWords ? `${(preview.totalWords / 1000).toFixed(0)}k` : '0', icon: Hash, color: 'text-sky-400' },
          { label: 'Folders', value: Object.keys(preview?.folders || {}).length, icon: FolderTree, color: 'text-amber-400' },
          { label: 'Exports', value: config?.exportCount || 0, icon: Download, color: 'text-emerald-400' },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
            <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
            <div className="text-lg font-semibold tabular-nums">{stat.value}</div>
            <div className="text-[10px] text-zinc-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Settings Panel */}
      {showSettings && config && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-1.5">
            <Settings2 className="w-4 h-4 text-teal-400" />
            Export Settings
          </h3>

          {/* Vault Name */}
          <div className="mb-4">
            <label className="text-xs text-zinc-500 mb-1 block">Vault Name</label>
            <input
              value={config.vaultName}
              onChange={e => setConfig({ ...config, vaultName: e.target.value })}
              onBlur={() => saveConfig({ vaultName: config.vaultName })}
              className="w-full h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 text-sm text-zinc-200 focus:outline-none focus:border-teal-500/30"
            />
          </div>

          {/* Folder Structure */}
          <div className="mb-4">
            <label className="text-xs text-zinc-500 mb-2 block">Folder Structure</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {FOLDER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => saveConfig({ folderStructure: opt.value as any })}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    config.folderStructure === opt.value
                      ? 'border-teal-500/30 bg-teal-500/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="text-xs font-medium">{opt.label}</div>
                  <div className="text-[10px] text-zinc-500">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            {[
              { key: 'frontmatterStyle', label: 'YAML Frontmatter', desc: 'Include metadata as YAML frontmatter', icon: Code, checked: config.frontmatterStyle === 'yaml' },
              { key: 'includeTags', label: 'Include Tags', desc: 'Add tags to frontmatter', icon: Tag, checked: config.includeTags },
              { key: 'includeWikilinks', label: 'Wikilinks', desc: 'Add [[wikilinks]] to related notes', icon: Link2, checked: config.includeWikilinks },
              { key: 'includeBacklinks', label: 'Backlinks Section', desc: 'Add Related section with backlinks', icon: BookOpen, checked: config.includeBacklinks },
              { key: 'includeMetadata', label: 'Extra Metadata', desc: 'Word count, language, domain', icon: Layers, checked: config.includeMetadata },
            ].map(toggle => (
              <button
                key={toggle.key}
                onClick={() => {
                  const update: any = {};
                  if (toggle.key === 'frontmatterStyle') {
                    update.frontmatterStyle = config.frontmatterStyle === 'yaml' ? 'none' : 'yaml';
                  } else {
                    update[toggle.key] = !(config as any)[toggle.key];
                  }
                  saveConfig(update);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <toggle.icon className="w-3.5 h-3.5 text-zinc-500" />
                <div className="flex-1 text-left">
                  <div className="text-xs font-medium">{toggle.label}</div>
                  <div className="text-[10px] text-zinc-600">{toggle.desc}</div>
                </div>
                <div className={`w-8 h-4.5 rounded-full transition-colors ${toggle.checked ? 'bg-teal-500' : 'bg-white/[0.08]'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white mt-[2px] transition-transform ${toggle.checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Folder Preview */}
      {preview && Object.keys(preview.folders).length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-4">
          <h3 className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5" />
            Vault Structure
          </h3>
          <div className="space-y-1">
            {Object.entries(preview.folders).sort((a, b) => b[1] - a[1]).map(([folder, count]) => (
              <div key={folder} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/[0.02]">
                <FolderTree className="w-3 h-3 text-teal-400/50" />
                <span className="text-xs text-zinc-400 flex-1 truncate">{folder}</span>
                <span className="text-[10px] text-zinc-600 tabular-nums">{count} notes</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source Breakdown */}
      {preview && Object.keys(preview.sourceBreakdown).length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-4">
          <h3 className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Source Types
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(preview.sourceBreakdown).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
              <span key={source} className="text-[10px] px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-zinc-400">
                <span className="capitalize">{source}</span>
                <span className="ml-1 text-teal-400">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={exporting || !preview?.filteredCount}
        className="w-full h-11 rounded-xl text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-2 mb-4"
      >
        {exporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Building vault...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export {preview?.filteredCount || 0} notes as Obsidian vault
          </>
        )}
      </button>

      {/* Last Export */}
      {config?.lastExportAt && (
        <p className="text-xs text-zinc-600 text-center mb-4">
          Last exported {formatTime(config.lastExportAt)}
        </p>
      )}

      {/* How to Use */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-4">
        <h3 className="text-xs font-medium text-zinc-400 mb-3">How to Use</h3>
        <ol className="space-y-2 text-xs text-zinc-500">
          {[
            'Click "Export" to download your knowledge as a ZIP file',
            'Extract the ZIP to your Obsidian vaults directory',
            'Open Obsidian → "Open folder as vault" → select the folder',
            'All your MindStore knowledge is now searchable in Obsidian',
          ].map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center text-[10px] font-medium shrink-0">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Sync History */}
      {(config?.syncHistory?.length || 0) > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center gap-1.5 text-xs font-medium text-zinc-400"
          >
            <History className="w-3.5 h-3.5" />
            Export History
            {showHistory ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
          </button>
          
          {showHistory && (
            <div className="mt-3 space-y-1.5">
              {(config?.syncHistory || []).map(record => (
                <div key={record.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02]">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    record.status === 'success' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
                  <span className="text-xs text-zinc-400">{record.count} notes exported</span>
                  <span className="text-[10px] text-zinc-600 ml-auto">{formatTime(record.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
