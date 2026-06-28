import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { QRCodeSVG } from 'qrcode.react';
import {
  LayoutDashboard, AlertTriangle, CheckCircle2, Users, MessageSquare,
  TrendingUp, Search, UserCheck, ChevronUp,
  ChevronDown, Wifi, Utensils, Zap, MapPin, Clock, RefreshCw,
  Bot, Send, Sparkles, Bell, X, Activity, Star,
  ArrowUpRight, Shield, CalendarPlus, Calendar, QrCode, Plus,
  ExternalLink, ChevronRight, Building2, ToggleLeft, ToggleRight, Trash2, LogOut,
  RotateCcw, AlertCircle, PackageOpen,
} from 'lucide-react';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale,
  LinearScale, BarElement, LineElement, PointElement, Filler
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { subscribeToIssues, subscribeToAlerts, updateIssueStatus, getDashboardStats, seedDemoData } from '../services/issueService';
import { createEvent, subscribeToEvents, deleteEvent, restoreEvent, permanentlyDeleteEvent, emptyTrash, subscribeToTrash, type TrashedEvent } from '../services/eventService';
import type { Issue, Alert, DashboardStats, Priority } from '../types';
import type { Event } from '../types';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler);

// ─── Priority badge ───────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: Priority }) {
  const cls = {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
  }[priority];
  return <span className={cls}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>;
}

function StatusBadge({ status }: { status: Issue['status'] }) {
  const cls = status === 'open' ? 'status-open' : status === 'in_progress' ? 'status-progress' : status === 'resolved' ? 'status-resolved' : 'status-progress';
  const label = status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={cls}>{label}</span>;
}

// ─── Category icons ───────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  wifi: <Wifi className="w-4 h-4" />,
  food: <Utensils className="w-4 h-4" />,
  power: <Zap className="w-4 h-4" />,
  charging: <Zap className="w-4 h-4" />,
  venue: <MapPin className="w-4 h-4" />,
};

function getCategoryIcon(category: string) {
  return CATEGORY_ICONS[category] || <AlertTriangle className="w-4 h-4" />;
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({
  label, value, icon, sub, color, trend,
}: {
  label: string; value: string | number; icon: React.ReactNode;
  sub?: string; color: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="metric-card group">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'}`}>
            {trend === 'up' ? <ChevronUp className="w-3 h-3" /> : trend === 'down' ? <ChevronDown className="w-3 h-3" /> : null}
            {trend !== 'neutral' && <ArrowUpRight className="w-3 h-3" />}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mb-0.5">{value}</div>
      <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
function AlertBanner({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  return (
    <div className="alert-critical">
      <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0">
        <Bell className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-red-800 dark:text-red-300">{alert.message}</p>
        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">💡 {alert.suggestedAction}</p>
      </div>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Organizer AI Chat ────────────────────────────────────────────────────────
function getOrganizerResponse(query: string, issues: Issue[]): string {
  const q = query.toLowerCase();
  const openIssues = issues.filter(i => i.status !== 'resolved');
  
  if (q.includes('biggest') || q.includes('major') || q.includes('worst')) {
    if (openIssues.length === 0) return '🎉 Good news! There are currently no open issues.';
    const biggest = [...openIssues].sort((a, b) => b.affectedParticipants - a.affectedParticipants)[0];
    return `🚨 **${biggest.category} in ${biggest.location}** is the biggest issue right now with **${biggest.affectedParticipants} participants affected**. Priority: ${biggest.priority}.`;
  }
  if (q.includes('enjoy') || q.includes('positive') || q.includes('good') || q.includes('appreciat')) {
    const positiveIssues = issues.filter(i => i.sentiment === 'positive');
    if (positiveIssues.length === 0) return 'Neutral sentiment so far. No specific appreciations recorded yet.';
    return `❤️ Participants are mostly appreciating **${positiveIssues[0].category}** in **${positiveIssues[0].location}**. ${positiveIssues.length} positive interactions recorded.`;
  }
  if (q.includes('immediate') || q.includes('urgent') || q.includes('now') || q.includes('attention')) {
    const critical = openIssues.filter(i => i.priority === 'critical');
    if (critical.length === 0) {
      if (openIssues.length === 0) return '✅ No critical issues need immediate attention right now.';
      const biggest = [...openIssues].sort((a, b) => b.affectedParticipants - a.affectedParticipants)[0];
      return `⚡ No critical issues, but the **${biggest.category} issue in ${biggest.location}** affects ${biggest.affectedParticipants} people.`;
    }
    return `⚡ The **${critical[0].category} issue in ${critical[0].location}** needs immediate attention — ${critical[0].affectedParticipants} participants are affected.`;
  }
  if (q.includes('tomorrow') || q.includes('next') || q.includes('improve') || q.includes('future')) {
    const topCategories = [...new Set(issues.map(i => i.category))];
    if (topCategories.length === 0) return 'Not enough data for suggestions yet. Run the event a bit longer!';
    return `📝 For tomorrow, recommend focusing on: **${topCategories.join(', ')}** based on today's feedback.`;
  }
  
  return `📊 Currently tracking **${openIssues.length} active issues** out of ${issues.length} total reports. Top categories: ${[...new Set(openIssues.map(i => i.category))].slice(0,3).join(', ') || 'None'}.`;
}

interface OrgChatMsg { role: 'user' | 'ai'; text: string }

function OrganizerChat({ issues }: { issues: Issue[] }) {
  const [messages, setMessages] = useState<OrgChatMsg[]>([
    { role: 'ai', text: '👋 Hi! I\'m your **Event Intelligence Assistant**. Ask me anything about the event.\n\nTry:\n• "What is the biggest issue right now?"\n• "What are participants enjoying?"\n• "What needs immediate attention?"' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const send = async () => {
    if (!input.trim()) return;
    const q = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setTyping(true);
    await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
    const response = getOrganizerResponse(q, issues);
    setTyping(false);
    setMessages(prev => [...prev, { role: 'ai', text: response }]);
  };

  const QUICK = ["What's the biggest issue?", "What are participants enjoying?", "What needs immediate attention?", "Suggestions for tomorrow?"];

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col h-96">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">AI Event Intelligence</span>
        <span className="ml-auto text-xs text-green-500 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />Live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-2xl px-3 py-2.5 max-w-[90%] text-sm leading-relaxed message-in ${
              m.role === 'user'
                ? 'bg-gradient-to-br from-brand-500 to-violet-600 text-white rounded-tr-sm'
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tl-sm'
            }`}>
              <ReactMarkdown>{m.text}</ReactMarkdown>
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="bubble-ai py-3 px-4">
              <div className="flex gap-1">
                <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-2">
        <div className="flex flex-wrap gap-1 mb-2">
          {QUICK.slice(0, 2).map(q => (
            <button key={q} onClick={() => { setInput(q); }} className="chip text-xs py-1 px-2">{q}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about the event..."
            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-900 dark:text-gray-100"
          />
          <button onClick={send} className="w-8 h-8 bg-gradient-to-br from-brand-500 to-violet-600 rounded-xl flex items-center justify-center hover:scale-110 transition-transform">
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Issue Row ────────────────────────────────────────────────────────────────
function IssueRow({ issue, onUpdate }: { issue: Issue; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (status: Issue['status']) => {
    setLoading(true);
    await updateIssueStatus(issue.id, status);
    onUpdate();
    setLoading(false);
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0">
            {getCategoryIcon(issue.category)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{issue.title}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{issue.category}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <MapPin className="w-3 h-3" />
          {issue.location}
        </div>
      </td>
      <td className="px-4 py-3">
        <PriorityBadge priority={issue.priority} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={issue.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          <span className={`text-sm font-bold ${issue.affectedParticipants >= 5 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {issue.affectedParticipants}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          {Math.round((Date.now() - new Date(issue.reportedAt).getTime()) / 60000)}m ago
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {issue.status === 'resolved' ? (
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-bold text-xs px-2.5 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
              <CheckCircle2 className="w-4 h-4" />
              Resolved
            </div>
          ) : (
            <>
              {issue.status === 'open' && (
                <button
                  onClick={() => handleAction('in_progress')}
                  disabled={loading}
                  className="px-2.5 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors font-semibold shadow-sm border border-blue-100 dark:border-blue-800"
                >
                  Start
                </button>
              )}
              <button
                onClick={() => handleAction('resolved')}
                disabled={loading}
                className="px-2.5 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold shadow-sm"
              >
                Resolve
              </button>
              {issue.status !== 'escalated' && issue.priority !== 'critical' && (
                <button
                  onClick={() => handleAction('escalated')}
                  disabled={loading}
                  className="px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors font-medium opacity-0 group-hover:opacity-100"
                >
                  Escalate
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({
  event,
  issueCount,
  onConfirm,
  onCancel,
}: {
  event: Event;
  issueCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}>
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up border border-red-100 dark:border-red-900/30">
        {/* Red top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 to-rose-500" />

        <div className="p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">Delete "{event.name}"?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">This will move the event to the recycle bin.</p>
            </div>
          </div>

          {/* Warning list */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-100 dark:border-red-800 mb-5">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2 uppercase tracking-wide">The following will be permanently wiped:</p>
            <ul className="space-y-1.5">
              {[
                `${issueCount} issue${issueCount !== 1 ? 's' : ''} and all reports`,
                'All participant data for this event',
                'All alerts linked to this event',
                'Dashboard stats will reset to reflect remaining events',
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 mb-5 text-center">
            💡 You can recover this event from the <strong>Recycle Bin</strong> within your session.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Move to Bin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Trash / Recycle Bin Panel ────────────────────────────────────────────────
function TrashPanel({
  trash,
  onRestore,
  onPermanentDelete,
  onEmptyAll,
  onClose,
}: {
  trash: TrashedEvent[];
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onEmptyAll: () => void;
  onClose: () => void;
}) {
  const [confirmPerm, setConfirmPerm] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Trash2 className="w-4.5 h-4.5 text-gray-500" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Recycle Bin</h3>
              <p className="text-xs text-gray-400">{trash.length} deleted event{trash.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {trash.length > 0 && (
              <button
                onClick={onEmptyAll}
                className="text-xs text-red-500 hover:text-red-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Empty All
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {trash.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <PackageOpen className="w-12 h-12 opacity-30" />
              <p className="text-sm font-medium">Recycle bin is empty</p>
              <p className="text-xs">Deleted events appear here</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {trash.map(({ event, deletedAt, issueCount }) => (
                <div key={event.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 group">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">{event.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {issueCount} issue{issueCount !== 1 ? 's' : ''} · Deleted {deletedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {deletedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {event.venue && <p className="text-xs text-gray-400 truncate">{event.venue}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Recover */}
                    <button
                      onClick={() => onRestore(event.id)}
                      title="Recover event"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-lg hover:bg-emerald-100 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Recover
                    </button>
                    {/* Permanent delete */}
                    {confirmPerm === event.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { onPermanentDelete(event.id); setConfirmPerm(null); }}
                          className="px-2 py-1.5 text-xs font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                        >
                          Delete Forever
                        </button>
                        <button
                          onClick={() => setConfirmPerm(null)}
                          className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmPerm(event.id)}
                        title="Delete permanently"
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs text-gray-400 text-center">
            💡 Recovered events will reappear in your Events page. Deleted data cannot be recovered.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Create Event Modal ───────────────────────────────────────────────────────
function CreateEventModal({ onClose, onCreate }: { onClose: () => void; onCreate: (event: Event) => void }) {
  const [form, setForm] = useState({ name: '', description: '', venue: '', date: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Event name is required'); return; }
    setLoading(true);
    try {
      const event = createEvent(form);
      onCreate(event);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-500 to-violet-600 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <CalendarPlus className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Create New Event</h2>
                <p className="text-brand-100 text-sm">Set up your event & get a unique QR code</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-2 border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Event Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. HackFest 2026, TechSummit, Annual Fest..."
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-900 dark:text-gray-100"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of the event..."
              rows={2}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Venue
              </label>
              <input
                type="text"
                value={form.venue}
                onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                placeholder="e.g. Main Auditorium"
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-brand-500 to-violet-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── QR Modal ─────────────────────────────────────────────────────────────────
function QRModal({ event, onClose }: { event: Event; onClose: () => void }) {
  const [location, setLocation] = useState('');
  const [mode, setMode] = useState<'chat' | 'form'>('form');
  
  const modePath = mode === 'form' ? 'report' : 'chat';
  const baseUrl = `${window.location.origin}/${modePath}?eventId=${event.id}`;
  const targetUrl = location ? `${baseUrl}&location=${encodeURIComponent(location)}` : baseUrl;
  const qrPageUrl = `/qr?eventId=${event.id}${location ? `&location=${encodeURIComponent(location)}` : ''}&mode=${mode}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.7)' }}>
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-brand-950 border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="p-6 pb-0 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{event.name}</h2>
            <p className="text-gray-400 text-sm mt-0.5">Scan to raise issues via AI chat</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code */}
        <div className="p-6 flex flex-col items-center">
          <div className="relative">
            <div className="absolute inset-0 bg-brand-500/30 blur-2xl rounded-2xl scale-110" />
            <div className="relative bg-white rounded-2xl p-5 shadow-2xl">
              <QRCodeSVG
                value={targetUrl}
                size={200}
                fgColor="#4f46e5"
                bgColor="#ffffff"
                level="H"
                includeMargin={false}
              />
            </div>
          </div>

          <div className="mt-5 text-center w-full">
            <div className="flex flex-col gap-3 mb-4 w-full">
              <div className="flex bg-white/10 rounded-xl p-1">
                <button
                  onClick={() => setMode('chat')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${mode === 'chat' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  AI Chat
                </button>
                <button
                  onClick={() => setMode('form')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${mode === 'form' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  Direct Form
                </button>
              </div>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Optional: Pre-fill Location (e.g. Hall A)"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-brand-300 font-mono break-all mb-4">
              {targetUrl}
            </div>

            <div className="flex gap-2">
              <a
                href={targetUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Test Link
              </a>
              <a
                href={qrPageUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-brand-500 to-violet-600 text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                <QrCode className="w-3.5 h-3.5" />
                Fullscreen QR
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({ event, issueCount, onShowQR, onViewIssues, onDelete }: {
  event: Event;
  issueCount: number;
  onShowQR: () => void;
  onViewIssues: () => void;
  onDelete: () => void;
}) {
  const formattedDate = event.date
    ? new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'No date set';

  return (
    <div className="card group hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800 hover:border-brand-200 dark:hover:border-brand-700 relative">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">{event.name}</h3>
            {event.venue && (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3" /> {event.venue}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
            event.isActive
              ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${event.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {event.isActive ? 'Active' : 'Inactive'}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Delete Event"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {event.description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{event.description}</p>
      )}

      <div className="flex items-center gap-3 mb-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" /> {formattedDate}
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-orange-400" />
          <span className={`font-semibold ${issueCount > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
            {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
          </span>
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onShowQR}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-brand-500 to-violet-600 text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          <QrCode className="w-3.5 h-3.5" />
          Show QR
        </button>
        <button
          onClick={onViewIssues}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          View Issues
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function OrganizerDashboard() {
  const [passcode, setPasscode] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem('eventmind_dashboard_unlocked') === 'true';
  });
  const [passcodeError, setPasscodeError] = useState('');

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const correctCode = import.meta.env.VITE_DASHBOARD_CODE || 'hack-you';
    if (passcode === correctCode) {
      sessionStorage.setItem('eventmind_dashboard_unlocked', 'true');
      setIsUnlocked(true);
      setPasscodeError('');
    } else {
      setPasscodeError('Invalid passcode. Please try again.');
    }
  };
  const [user, setUser] = useState<User | { displayName: string | null; email: string | null; photoURL: string | null } | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    if (isFirebaseConfigured() && auth) {
      return onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoadingAuth(false);
      });
    } else {
      const demoUser = sessionStorage.getItem('eventmind_demo_user');
      if (demoUser) {
        setUser(JSON.parse(demoUser));
      }
      setLoadingAuth(false);
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setLoadingAuth(true);
    if (isFirebaseConfigured() && auth) {
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        setUser(result.user);
      } catch (err: any) {
        console.error('Firebase Google Sign-In error:', err);
        alert(err.message || 'Failed to sign in with Google');
      } finally {
        setLoadingAuth(false);
      }
    } else {
      setTimeout(() => {
        const mockUser = {
          displayName: 'Demo Organizer',
          email: 'organizer@eventmind.ai',
          photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=faces',
        };
        sessionStorage.setItem('eventmind_demo_user', JSON.stringify(mockUser));
        setUser(mockUser);
        setLoadingAuth(false);
      }, 800);
    }
  };

  const handleSignOut = async () => {
    if (isFirebaseConfigured() && auth) {
      await signOut(auth);
    } else {
      sessionStorage.removeItem('eventmind_demo_user');
      setUser(null);
    }
  };
  const [issues, setIssues] = useState<Issue[]>([]);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    liveParticipants: 0, totalConversations: 0, openIssues: 0,
    resolvedIssues: 0, criticalAlerts: 0, satisfactionScore: 0, avgResponseTime: 0,
    averageRating: 0,
  });
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'critical' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [activePage, setActivePage] = useState<'dashboard' | 'issues' | 'analytics' | 'ai' | 'events'>('dashboard');
  const [_refresh, setRefresh] = useState(0);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [qrEvent, setQrEvent] = useState<Event | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');

  // Trash / delete state
  const [trash, setTrash] = useState<TrashedEvent[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<Event | null>(null);
  const [showTrashPanel, setShowTrashPanel] = useState(false);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Subscribe to live data
  useEffect(() => {
    const unsub1 = subscribeToIssues(newIssues => {
      setAllIssues(newIssues);
    });
    const unsub2 = subscribeToAlerts(setAlerts);
    const unsub3 = subscribeToEvents(setEvents);
    const unsub4 = subscribeToTrash(setTrash);
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };

  }, []);

  // Filter issues by selected event and update stats
  useEffect(() => {
    const filtered = selectedEventId === 'all' 
      ? allIssues 
      : allIssues.filter(i => i.eventId === selectedEventId);
    setIssues(filtered);
    setStats(getDashboardStats(filtered));
  }, [allIssues, selectedEventId]);

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleEventCreated = (event: Event) => {
    // Auto-open QR after creating
    setQrEvent(event);
  };

  // Filter issues
  const filteredIssues = issues
    .filter(i => {
      if (activeTab === 'open') return i.status === 'open' || i.status === 'in_progress';
      if (activeTab === 'critical') return i.priority === 'critical';
      if (activeTab === 'resolved') return i.status === 'resolved';
      return true;
    })
    .filter(i =>
      !searchQuery || i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Chart data
  const categoryData = {
    labels: ['Wi-Fi', 'Food', 'Power', 'Venue', 'Sessions', 'Other'],
    datasets: [{
      data: [
        issues.filter(i => i.category === 'wifi').length,
        issues.filter(i => i.category === 'food').length,
        issues.filter(i => i.category === 'power').length,
        issues.filter(i => i.category === 'venue').length,
        issues.filter(i => i.category === 'sessions').length,
        issues.filter(i => !['wifi','food','power','venue','sessions'].includes(i.category)).length,
      ],
      backgroundColor: ['#6366f1','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444'],
      borderWidth: 0,
      hoverOffset: 8,
    }],
  };

  const sentimentData = {
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [{
      data: [
        issues.filter(i => i.sentiment === 'positive').reduce((a, b) => a + b.affectedParticipants, 0),
        issues.filter(i => i.sentiment === 'neutral').reduce((a, b) => a + b.affectedParticipants, 0),
        issues.filter(i => i.sentiment === 'negative').reduce((a, b) => a + b.affectedParticipants, 0),
      ],
      backgroundColor: ['#10b981', '#6366f1', '#ef4444'],
      borderWidth: 0,
    }],
  };

  // Dynamic Trend Data (last 6 buckets, 1 hour each)
  const generateTrendData = () => {
    const now = new Date();
    const labels = [];
    const reportsData = [];
    const resolvedData = [];
    
    for (let i = 5; i >= 0; i--) {
      const bucketTime = new Date(now.getTime() - i * 60 * 60 * 1000);
      labels.push(bucketTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      
      const bucketStart = bucketTime.getTime() - 30 * 60 * 1000;
      const bucketEnd = bucketTime.getTime() + 30 * 60 * 1000;
      
      const reports = issues.filter(iss => {
        const time = new Date(iss.reportedAt).getTime();
        return time >= bucketStart && time < bucketEnd;
      }).length;
      
      const resolutions = issues.filter(iss => {
        if (iss.status !== 'resolved') return false;
        const resolvedTime = iss.resolvedAt ? new Date(iss.resolvedAt).getTime() : new Date(iss.reportedAt).getTime() + 5 * 60000;
        return resolvedTime >= bucketStart && resolvedTime < bucketEnd;
      }).length;
      
      reportsData.push(reports);
      resolvedData.push(resolutions);
    }
    
    return {
      labels,
      datasets: [
        {
          label: 'Reports',
          data: reportsData,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#6366f1',
        },
        {
          label: 'Resolved',
          data: resolvedData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#10b981',
        },
      ]
    };
  };

  const trendData = generateTrendData();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { padding: 16, font: { size: 12 } } } },
  };

  const lineOptions = {
    ...chartOptions,
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
    },
  };

  const NAV = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'events', icon: CalendarPlus, label: 'Events' },
    { id: 'issues', icon: AlertTriangle, label: 'Issues' },
    { id: 'analytics', icon: TrendingUp, label: 'Analytics' },
    { id: 'ai', icon: Bot, label: 'AI Assistant' },
  ];

  if (!isUnlocked) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-brand-950 to-slate-950 p-6 font-sans relative overflow-hidden">
        {/* Background blobs for premium mesh effect */}
        <div className="absolute w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[100px] -top-40 -left-40 animate-pulse" />
        <div className="absolute w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[100px] -bottom-40 -right-40 animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Organizer Portal</h2>
          <p className="text-gray-400 text-sm mb-8">Please enter the security passcode to access the EventMind AI dashboard.</p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <input
                type="password"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                placeholder="Enter passcode..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-center text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all font-mono tracking-widest"
                autoFocus
              />
              {passcodeError && (
                <p className="text-red-400 text-xs mt-2 font-medium">{passcodeError}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-brand-500 to-violet-600 hover:opacity-90 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              Access Dashboard
            </button>
          </form>

          <p className="text-xs text-gray-500 mt-8 tracking-wide font-medium">
            🔒 Protected by EventMind AI · Secure Console
          </p>
        </div>
      </div>
    );
  }

  if (isUnlocked && !user) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-brand-950 to-slate-950 p-6 font-sans relative overflow-hidden">
        {/* Background blobs for premium mesh effect */}
        <div className="absolute w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[100px] -top-40 -left-40 animate-pulse" />
        <div className="absolute w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[100px] -bottom-40 -right-40 animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-xl">
              <Bot className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Organizer Sign-In</h2>
          <p className="text-gray-400 text-sm mb-8">Sign in with your Google account to manage your events and monitor live issues.</p>

          <button
            onClick={handleGoogleSignIn}
            disabled={loadingAuth}
            className="w-full py-3.5 bg-white text-black hover:bg-gray-100 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-3 border border-white/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {loadingAuth ? (
              <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" width="24" height="24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" stroke="none" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 mt-8 tracking-wide font-medium">
            🔒 Secured with Firebase Authentication
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Modals */}
      {showCreateModal && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleEventCreated}
        />
      )}
      {qrEvent && (
        <QRModal event={qrEvent} onClose={() => setQrEvent(null)} />
      )}
      {deleteConfirm && (
        <DeleteConfirmModal
          event={deleteConfirm}
          issueCount={allIssues.filter(i => i.eventId === deleteConfirm.id).length}
          onConfirm={() => {
            deleteEvent(deleteConfirm.id, allIssues.filter(i => i.eventId === deleteConfirm.id).length);
            setDeleteConfirm(null);
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
      {showTrashPanel && (
        <TrashPanel
          trash={trash}
          onRestore={(id) => restoreEvent(id)}
          onPermanentDelete={(id) => permanentlyDeleteEvent(id)}
          onEmptyAll={() => emptyTrash()}
          onClose={() => setShowTrashPanel(false)}
        />
      )}

      {/* Sidebar */}
      <aside className="w-64 glass border-r border-gray-100 dark:border-gray-800 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white text-sm">EventMind AI</h1>
              <p className="text-xs text-gray-400">Organizer Console</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id as typeof activePage)}
              className={`nav-item w-full ${activePage === item.id ? 'active' : ''}`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {item.id === 'events' && events.length > 0 && (
                <span className="ml-auto text-xs bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded-full font-semibold">
                  {events.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-1">
          <a
            href={events.length > 0 ? `/chat?eventId=${selectedEventId !== 'all' ? selectedEventId : events[0].id}` : "/chat"}
            className="nav-item flex items-center gap-3 text-sm w-full"
            target="_blank"
          >
            <MessageSquare className="w-4 h-4" />
            Participant Chat
          </a>
          <a
            href={events.length > 0 ? `/qr?eventId=${selectedEventId !== 'all' ? selectedEventId : events[0].id}` : "/qr"}
            className="nav-item flex items-center gap-3 text-sm w-full"
            target="_blank"
          >
            <Activity className="w-4 h-4" />
            QR Display
          </a>
          {/* Recycle Bin button */}
          <button
            onClick={() => setShowTrashPanel(true)}
            className="nav-item w-full flex items-center gap-3 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Recycle Bin
            {trash.length > 0 && (
              <span className="ml-auto text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-semibold">
                {trash.length}
              </span>
            )}
          </button>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400 text-xs">Dark Mode</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`relative w-10 h-5 rounded-full transition-colors ${darkMode ? 'bg-brand-500' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        {user && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800">
            {/* Profile card — shows name and email prominently */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
              <img
                src={user.photoURL || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=faces'}
                alt={user.displayName || 'User'}
                className="w-10 h-10 rounded-xl border-2 border-white dark:border-gray-700 shadow-sm flex-shrink-0 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate leading-tight">
                  {user.displayName || 'Organizer'}
                </p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                  {user.email || ''}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 glass border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white capitalize">
              {activePage === 'ai' ? 'AI Assistant' : activePage}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-500 to-violet-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Create Event
            </button>
            <button
              onClick={() => setRefresh(r => r + 1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            <div className="flex items-center gap-1.5 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Live Monitoring
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Critical Alerts */}
          {alerts.filter(a => !a.acknowledged).length > 0 && (
            <div className="space-y-2 animate-fade-in-up">
              {alerts.filter(a => !a.acknowledged).map(a => (
                <AlertBanner key={a.id} alert={a} onDismiss={() => dismissAlert(a.id)} />
              ))}
            </div>
          )}

          {/* ── Dashboard Overview ── */}
          {activePage === 'dashboard' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                  label="Live Participants"
                  value={stats.liveParticipants || 0}
                  icon={<Users className="w-5 h-5 text-blue-600" />}
                  color="bg-blue-50 dark:bg-blue-900/30"
                  sub="Active in chat"
                  trend="up"
                />
                <MetricCard
                  label="Open Issues"
                  value={stats.openIssues}
                  icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
                  color="bg-orange-50 dark:bg-orange-900/30"
                  sub={`${stats.criticalAlerts} critical`}
                  trend={stats.openIssues > 3 ? 'down' : 'neutral'}
                />
                <MetricCard
                  label="Resolved"
                  value={stats.resolvedIssues}
                  icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
                  color="bg-green-50 dark:bg-green-900/30"
                  sub="This session"
                  trend="up"
                />
                <MetricCard
                  label="Avg Rating"
                  value={stats.averageRating > 0 ? `${stats.averageRating} ★` : 'N/A'}
                  icon={<Star className="w-5 h-5 text-yellow-500" />}
                  color="bg-yellow-50 dark:bg-yellow-900/30"
                  sub="From direct reports"
                  trend="neutral"
                />
                <MetricCard
                  label="Events Created"
                  value={events.length || 0}
                  icon={<CalendarPlus className="w-5 h-5 text-purple-600" />}
                  color="bg-purple-50 dark:bg-purple-900/30"
                  sub={events.length > 0 ? `${events.filter(e => e.isActive).length} active` : 'No events yet'}
                  trend="neutral"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 card">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand-500" />
                    Issue Trend (Today)
                  </h3>
                  <div className="h-48">
                    <Line data={trendData} options={lineOptions} />
                  </div>
                </div>
                <div className="card">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Issue Categories</h3>
                  <div className="h-48">
                    <Doughnut data={categoryData} options={chartOptions} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-brand-500" />
                    Recent Issues
                  </h3>
                  <div className="space-y-3">
                    {allIssues.slice(0, 4).map(issue => (
                      <div key={issue.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center flex-shrink-0">
                          {getCategoryIcon(issue.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{issue.title}</p>
                          <p className="text-xs text-gray-400">{issue.location} · {issue.affectedParticipants} affected</p>
                        </div>
                        <PriorityBadge priority={issue.priority} />
                      </div>
                    ))}
                    {allIssues.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-6">No issues yet. Create an event and share the QR!</p>
                    )}
                  </div>
                </div>
                <OrganizerChat issues={issues} />
              </div>

              {/* Quick Create CTA if no events */}
              {events.length === 0 && (
                <div className="card border-2 border-dashed border-brand-200 dark:border-brand-800 bg-gradient-to-br from-brand-50/50 to-violet-50/50 dark:from-brand-950/30 dark:to-violet-950/30">
                  <div className="flex flex-col items-center text-center py-6 gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg">
                      <CalendarPlus className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg">Create Your First Event</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Generate a QR code so participants can report issues via AI chat</p>
                    </div>
                    <button
                      onClick={() => { setActivePage('events'); setShowCreateModal(true); }}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-500 to-violet-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg"
                    >
                      <Plus className="w-4 h-4" />
                      Create Event
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Events Page ── */}
          {activePage === 'events' && (
            <>
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-2xl">
                    <CalendarPlus className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Events Yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                      Create an event to generate a unique QR code. Participants scan it to chat with the AI and raise issues.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-brand-500 to-violet-600 text-white font-semibold rounded-2xl hover:opacity-90 transition-opacity shadow-xl text-base"
                  >
                    <Plus className="w-5 h-5" />
                    Create Your First Event
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Create New card */}
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="card border-2 border-dashed border-brand-200 dark:border-brand-800 hover:border-brand-400 dark:hover:border-brand-600 transition-colors flex flex-col items-center justify-center gap-3 min-h-[200px] group cursor-pointer bg-transparent"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="w-6 h-6 text-brand-500" />
                    </div>
                    <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">Create New Event</span>
                  </button>

                  {events.map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      issueCount={allIssues.filter(i => i.eventId === event.id).length}
                      onShowQR={() => setQrEvent(event)}
                      onViewIssues={() => {
                        setSelectedEventId(event.id);
                        setActivePage('issues');
                      }}
                      onDelete={() => setDeleteConfirm(event)}

                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Issues Page ── */}
          {activePage === 'issues' && (
            <div className="card">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-lg">All Issues</h3>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Event filter */}
                  {events.length > 0 && (
                    <select
                      value={selectedEventId}
                      onChange={e => setSelectedEventId(e.target.value)}
                      className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-900 dark:text-gray-100"
                    >
                      <option value="all">All Events</option>
                      {events.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  )}
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search issues..."
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                  </div>
                </div>
              </div>

              {/* Active event indicator */}
              {selectedEventId !== 'all' && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-100 dark:border-brand-800">
                  <Calendar className="w-3.5 h-3.5 text-brand-500" />
                  <span className="text-xs font-medium text-brand-700 dark:text-brand-300">
                    Showing issues for: <strong>{events.find(e => e.id === selectedEventId)?.name}</strong>
                  </span>
                  <button
                    onClick={() => setSelectedEventId('all')}
                    className="ml-auto text-brand-400 hover:text-brand-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex gap-2 mb-4 flex-wrap">
                {(['all', 'open', 'critical', 'resolved'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      activeTab === tab
                        ? 'bg-gradient-to-r from-brand-500 to-violet-500 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    <span className="ml-1.5 text-xs opacity-70">
                      ({tab === 'all' ? issues.length
                        : tab === 'open' ? issues.filter(i => i.status === 'open' || i.status === 'in_progress').length
                        : tab === 'critical' ? issues.filter(i => i.priority === 'critical').length
                        : issues.filter(i => i.status === 'resolved').length})
                    </span>
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="px-4 py-3 font-semibold">Issue</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">Priority</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Affected</th>
                      <th className="px-4 py-3 font-semibold">Reported</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredIssues.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                          {selectedEventId !== 'all'
                            ? 'No issues reported for this event yet. Share the QR code with participants!'
                            : 'No issues found.'}
                        </td>
                      </tr>
                    ) : filteredIssues.map(issue => (
                      <IssueRow key={issue.id} issue={issue} onUpdate={() => setRefresh(r => r + 1)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Analytics ── */}
          {activePage === 'analytics' && (() => {
            const total = issues.length || 1;
            const categoryStats = [
              { label: 'Wi-Fi', key: 'wifi', color: '#6366f1', icon: '📶' },
              { label: 'Food', key: 'food', color: '#f59e0b', icon: '🍕' },
              { label: 'Power', key: 'power', color: '#10b981', icon: '🔌' },
              { label: 'Venue', key: 'venue', color: '#3b82f6', icon: '🏢' },
              { label: 'Sessions', key: 'sessions', color: '#8b5cf6', icon: '🎤' },
              { label: 'Other', key: 'other', color: '#ef4444', icon: '💬' },
            ].map(c => ({ ...c, count: issues.filter(i => i.category === c.key).length, pct: Math.round((issues.filter(i => i.category === c.key).length / total) * 100) }));
            const sentStats = [
              { label: 'Positive 😊', key: 'positive', color: 'bg-emerald-500', text: 'text-emerald-600' },
              { label: 'Neutral 😐', key: 'neutral', color: 'bg-indigo-500', text: 'text-indigo-600' },
              { label: 'Negative 😞', key: 'negative', color: 'bg-red-500', text: 'text-red-600' },
            ].map(s => ({ ...s, count: issues.filter(i => i.sentiment === s.key).length, pct: Math.round((issues.filter(i => i.sentiment === s.key).length / total) * 100) }));
            const statusStats = [
              { label: 'Open', key: 'open', color: 'bg-orange-500', text: 'text-orange-600' },
              { label: 'In Progress', key: 'in_progress', color: 'bg-blue-500', text: 'text-blue-600' },
              { label: 'Resolved', key: 'resolved', color: 'bg-green-500', text: 'text-green-600' },
              { label: 'Escalated', key: 'escalated', color: 'bg-red-500', text: 'text-red-600' },
            ].map(s => ({ ...s, count: issues.filter(i => i.status === s.key).length, pct: Math.round((issues.filter(i => i.status === s.key).length / total) * 100) }));
            const priorityStats = [
              { label: 'Critical 🔴', key: 'critical', color: 'bg-red-600', text: 'text-red-600' },
              { label: 'High 🟠', key: 'high', color: 'bg-orange-500', text: 'text-orange-600' },
              { label: 'Medium 🟡', key: 'medium', color: 'bg-yellow-500', text: 'text-yellow-600' },
              { label: 'Low 🟢', key: 'low', color: 'bg-green-500', text: 'text-green-600' },
            ].map(p => ({ ...p, count: issues.filter(i => i.priority === p.key).length, pct: Math.round((issues.filter(i => i.priority === p.key).length / total) * 100) }));
            const ratedIssues = issues.filter(i => i.rating !== undefined);
            const ratingStats = [5, 4, 3, 2, 1].map(star => ({ star, count: ratedIssues.filter(i => i.rating === star).length, pct: ratedIssues.length > 0 ? Math.round((ratedIssues.filter(i => i.rating === star).length / ratedIssues.length) * 100) : 0 }));
            const avgRating = ratedIssues.length > 0 ? (ratedIssues.reduce((s, i) => s + (i.rating || 0), 0) / ratedIssues.length).toFixed(1) : '—';
            const resolvedCount = issues.filter(i => i.status === 'resolved').length;
            const resolutionRate = Math.round((resolvedCount / total) * 100);
            const PercentBar = ({ label, pct, color, text, count }: { label: string; pct: number; color: string; text: string; count: number }) => (
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{label}</span>
                  <span className={`font-bold ${text}`}>{pct}% <span className="text-gray-400 font-normal">({count})</span></span>
                </div>
                <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Submissions', val: issues.length, sub: 'All reports', color: 'text-indigo-600' },
                    { label: 'Resolution Rate', val: `${resolutionRate}%`, sub: `${resolvedCount} resolved`, color: 'text-green-600' },
                    { label: 'Avg Rating', val: avgRating !== '—' ? `${avgRating} ★` : '—', sub: `${ratedIssues.length} rated`, color: 'text-yellow-600' },
                    { label: 'Affected Users', val: issues.reduce((s, i) => s + i.affectedParticipants, 0), sub: 'Total impacted', color: 'text-red-600' },
                  ].map(m => (
                    <div key={m.label} className="card flex flex-col gap-1">
                      <div className={`text-2xl font-black ${m.color}`}>{m.val}</div>
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{m.label}</div>
                      <div className="text-xs text-gray-400">{m.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="card space-y-4">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />Issue Category Breakdown</h3>
                    <div className="h-48"><Doughnut data={{ labels: categoryStats.map(c => c.label), datasets: [{ data: categoryStats.map(c => c.count), backgroundColor: categoryStats.map(c => c.color), borderWidth: 2, hoverOffset: 8 }] }} options={{ ...chartOptions, cutout: '65%' } as any} /></div>
                    <div className="space-y-2.5 mt-2">
                      {categoryStats.map(c => (
                        <div key={c.key} className="space-y-1">
                          <div className="flex justify-between text-xs"><span className="text-gray-600 dark:text-gray-400">{c.icon} {c.label}</span><span className="font-bold" style={{ color: c.color }}>{c.pct}% ({c.count})</span></div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.pct}%`, backgroundColor: c.color }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />Rating Distribution</h3>
                      <div className="text-right"><div className="text-2xl font-black text-yellow-500">{avgRating} ★</div><div className="text-xs text-gray-400">{ratedIssues.length} responses</div></div>
                    </div>
                    <div className="space-y-3">
                      {ratingStats.map(r => (
                        <div key={r.star} className="flex items-center gap-3">
                          <div className="flex items-center gap-0.5 w-20 flex-shrink-0">{Array.from({ length: r.star }).map((_, i) => (<Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />))}</div>
                          <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full transition-all duration-700" style={{ width: `${r.pct}%` }} /></div>
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300 w-10 text-right">{r.pct}%</span>
                          <span className="text-xs text-gray-400 w-6">({r.count})</span>
                        </div>
                      ))}
                    </div>
                    {ratedIssues.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Ratings appear when users submit the Direct Form.</p>}
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sentiment Analysis</h4>
                      {sentStats.map(s => <PercentBar key={s.key} label={s.label} pct={s.pct} color={s.color} text={s.text} count={s.count} />)}
                    </div>
                  </div>
                  <div className="card space-y-4">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />Resolution Status</h3>
                    <div className="flex items-center gap-6">
                      <div className="relative w-28 h-28 flex-shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray={`${resolutionRate} ${100 - resolutionRate}`} strokeLinecap="round" className="transition-all duration-700" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-black text-green-600">{resolutionRate}%</span><span className="text-xs text-gray-400">resolved</span></div>
                      </div>
                      <div className="flex-1 space-y-2.5">{statusStats.map(s => <PercentBar key={s.key} label={s.label} pct={s.pct} color={s.color} text={s.text} count={s.count} />)}</div>
                    </div>
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Priority Breakdown</h4>
                      {priorityStats.map(p => <PercentBar key={p.key} label={p.label} pct={p.pct} color={p.color} text={p.text} count={p.count} />)}
                    </div>
                  </div>
                  <div className="card">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" />Live Issue Trend (Today)</h3>
                    <div className="h-52"><Line data={trendData} options={lineOptions} /></div>
                  </div>
                </div>
                <div className="card">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-500" />Most Affected Locations</h3>
                  {(() => {
                    const locationMap: Record<string, number> = {};
                    issues.forEach(i => { const loc = i.location || 'Unknown'; locationMap[loc] = (locationMap[loc] || 0) + i.affectedParticipants; });
                    const sorted = Object.entries(locationMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
                    const maxVal = sorted[0]?.[1] || 1;
                    return sorted.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No location data yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {sorted.map(([loc, count]) => (
                          <div key={loc} className="space-y-1">
                            <div className="flex justify-between text-xs"><span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400" />{loc}</span><span className="font-bold text-brand-600 dark:text-brand-400">{Math.round((count / maxVal) * 100)}% · {count} affected</span></div>
                            <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full transition-all duration-700" style={{ width: `${Math.round((count / maxVal) * 100)}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div className="card">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><Shield className="w-4 h-4 text-brand-500" />AI Recommendations for Next Event</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { title: 'Wi-Fi Planning', desc: 'Deploy 2× routers per hall. Reserve 1 backup router.', icon: Wifi, score: '94%' },
                      { title: 'Food Catering', desc: 'Order 30% more than expected participant count.', icon: Utensils, score: '88%' },
                      { title: 'Power Supply', desc: 'Install power strips every 3 seats in hackathon halls.', icon: Zap, score: '91%' },
                    ].map(rec => (
                      <div key={rec.title} className="p-4 bg-gradient-to-br from-brand-50 to-violet-50 dark:from-brand-900/20 dark:to-violet-900/20 rounded-xl border border-brand-100 dark:border-brand-800/30">
                        <div className="flex items-center gap-2 mb-2"><rec.icon className="w-4 h-4 text-brand-600 dark:text-brand-400" /><span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{rec.title}</span><span className="ml-auto text-xs text-green-600 dark:text-green-400 font-bold">{rec.score} success</span></div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{rec.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── AI Assistant ── */}
          {activePage === 'ai' && (
            <div className="max-w-2xl mx-auto">
              <OrganizerChat issues={issues} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
