import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Sparkles, Mail, User, CheckCircle, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../hooks/useAuth';
import { getEventById } from '../services/eventService';
import type { Message } from '../types';
import { isFirebaseConfigured } from '../lib/firebase';

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="bubble-ai flex items-center gap-1 py-4 px-5">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

// ─── Issue Filed Banner ────────────────────────────────────────────────────────
function IssueFiledBanner({ title }: { title?: string }) {
  return (
    <div className="flex justify-center my-2 animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
        bg-gradient-to-r from-emerald-500/15 to-green-500/15
        border border-emerald-400/30 text-emerald-700 dark:text-emerald-400
        shadow-sm backdrop-blur-sm">
        <ClipboardCheck className="w-3.5 h-3.5" />
        {title ? `"${title}" reported to management` : 'Issue reported to management'}
      </div>
    </div>
  );
}

// ─── Chat Bubble ─────────────────────────────────────────────────────────────
function ChatBubble({
  message,
  participantName,
  photoURL,
}: {
  message: Message;
  participantName: string | null;
  photoURL?: string | null;
}) {
  const isAI = message.role === 'ai';
  const initial = participantName ? participantName[0].toUpperCase() : '?';

  return (
    <div className={`flex items-end gap-3 message-in ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden ${
        isAI ? 'bg-gradient-to-br from-brand-500 to-violet-600' : 'bg-gradient-to-br from-blue-500 to-cyan-500'
      }`}>
        {isAI ? (
          <Sparkles className="w-4 h-4 text-white" />
        ) : photoURL ? (
          <img src={photoURL} alt={participantName || 'User'} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white text-xs font-bold">{initial}</span>
        )}
      </div>

      {/* Bubble */}
      <div className={`flex flex-col gap-1.5 ${isAI ? 'items-start' : 'items-end'} max-w-[82%]`}>
        <div className={isAI ? 'bubble-ai' : 'bubble-user'}>
          {isAI ? (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>p:last-child]:mb-0 [&>ul]:mt-1 [&>ul]:mb-1 [&>strong]:font-semibold">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{message.content}</p>
          )}
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ─── Quick Reply Chips ────────────────────────────────────────────────────────
function QuickReplies({ replies, onSelect, disabled }: {
  replies: string[];
  onSelect: (r: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-2 ml-11">
      {replies.map((reply, i) => (
        <button
          key={i}
          onClick={() => !disabled && onSelect(reply)}
          disabled={disabled}
          className={`chip text-xs transition-all duration-200 ${
            disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
          }`}
        >
          {reply}
        </button>
      ))}
    </div>
  );
}


// ─── Signed-In Badge ──────────────────────────────────────────────────────────
function SignedInBadge({ name, photoURL }: { name: string; photoURL: string | null }) {
  return (
    <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 px-2.5 py-1.5 rounded-full">
      {photoURL ? (
        <img src={photoURL} alt={name} className="w-4 h-4 rounded-full object-cover" />
      ) : (
        <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
      )}
      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 max-w-[90px] truncate">{name}</span>
    </div>
  );
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────
export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId') || undefined;
  const event = eventId ? getEventById(eventId) : undefined;

  // Auth
  const { user: authUser, loading: authLoading, signIn } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  // Chat hook
  const { messages, isTyping, sendMessage, participantName, phase } = useChat(
    eventId,
    authUser?.sessionId,
    authUser?.displayName
  );

  // Track reported issues to show the banner
  const [reportedIssues, setReportedIssues] = useState<Set<string>>(new Set());

  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || sending) return;
    setInputValue('');
    setSending(true);
    await sendMessage(text);
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleQuickReply = useCallback(async (reply: string) => {
    if (sending || isTyping) return;
    setSending(true);
    const clean = reply.replace(/^[^\w\s]*\s*/, '').trim();
    await sendMessage(clean || reply);
    setSending(false);
  }, [sending, isTyping, sendMessage]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try { await signIn(); }
    finally { setSigningIn(false); }
  };

  // Only show quick replies on the last AI message, and only when not typing
  const lastAIIndex = messages.map((m, i) => m.role === 'ai' ? i : -1).filter(i => i !== -1).pop();

  const displayName = authUser?.displayName || participantName;

  return (
    <div className="flex flex-col h-screen relative overflow-hidden bg-slate-50 dark:bg-gray-950 transition-colors duration-500">



      {/* Animated background */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-brand-50/20 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900" />
        <div className="absolute top-0 left-0 w-2/5 h-full bg-gradient-to-r from-brand-500/20 via-brand-400/8 to-transparent blur-[100px] animate-pulse-slow" />
        <div className="absolute top-0 right-0 w-2/5 h-full bg-gradient-to-l from-violet-500/20 via-violet-400/8 to-transparent blur-[100px]" />
      </div>

      {/* Main container */}
      <div className="flex flex-col h-full relative z-10 max-w-3xl mx-auto w-full shadow-2xl bg-white/50 dark:bg-gray-950/50 backdrop-blur-2xl border-x border-white/30 dark:border-white/5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-white/30 dark:border-gray-800/60 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl z-20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-900 shadow-sm" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white text-sm leading-tight">EventMind AI</h1>
              <p className="text-[11px] text-brand-600 dark:text-brand-400 font-medium">
                {event?.name || (displayName ? `Chatting as ${displayName}` : 'Event Assistant · Powered by Gemini')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {authUser && (
              <SignedInBadge name={authUser.displayName} photoURL={authUser.photoURL} />
            )}
            <div className="flex items-center gap-1.5 bg-white/60 dark:bg-gray-800/60 px-2.5 py-1.5 rounded-full border border-white/30 dark:border-white/5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.7)]" />
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold tracking-wider">LIVE</span>
            </div>
          </div>
        </header>

        {/* ── Messages ───────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scrollbar-hide">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-5 animate-fade-in-up">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-xl animate-float">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-700 dark:text-gray-200">EventMind AI</p>
                <p className="text-xs text-gray-400 mt-1">Starting your session...</p>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg, idx) => {
            const isLastAI = idx === lastAIIndex;
            const showReplies = isLastAI && !isTyping && msg.quickReplies && msg.quickReplies.length > 0;

            return (
              <div key={msg.id}>
                <ChatBubble
                  message={msg}
                  participantName={displayName}
                  photoURL={authUser?.photoURL}
                />
                {showReplies && (
                  <QuickReplies
                    replies={msg.quickReplies!}
                    onSelect={handleQuickReply}
                    disabled={sending || isTyping}
                  />
                )}
              </div>
            );
          })}

          {/* Typing */}
          {isTyping && (
            <div className="mt-1">
              <TypingIndicator />
            </div>
          )}

          <div ref={bottomRef} />
        </main>

        {/* ── Input area ─────────────────────────────────────────────────── */}
        <footer className="px-4 pb-6 pt-3 bg-gradient-to-t from-white/90 via-white/70 to-transparent dark:from-gray-950/90 dark:via-gray-950/70 z-20 flex-shrink-0">

          <div className="flex items-end gap-3 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKey}
                placeholder={phase === 'name' ? 'Type your name...' : 'Describe your issue or feedback...'}
                rows={1}
                className="chat-input min-h-[52px] max-h-32 shadow-[0_4px_24px_rgba(0,0,0,0.07)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] pr-4"
                style={{ height: 'auto' }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 128) + 'px';
                }}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || sending || isTyping}
              id="send-button"
              className={`w-13 h-13 w-[52px] h-[52px] rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-lg ${
                inputValue.trim() && !sending && !isTyping
                  ? 'bg-gradient-to-r from-brand-500 to-violet-600 text-white hover:scale-105 hover:shadow-brand-500/30 active:scale-95'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
              }`}
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4.5 h-4.5 w-[18px] h-[18px] ml-0.5" />
              )}
            </button>
          </div>

          {/* Footer label */}
          <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 mt-3 font-medium tracking-wide">
            {authUser
              ? `✅ Signed in as ${authUser.email} · Issues saved to your account`
              : '🔒 Your feedback helps organizers fix problems in real time · Powered by Gemini AI'}
          </p>
        </footer>

      </div>
    </div>
  );
}
