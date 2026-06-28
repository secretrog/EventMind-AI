import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Sparkles, Mail, LogIn, User, CheckCircle } from 'lucide-react';
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

// ─── Chat Bubble ─────────────────────────────────────────────────────────────
function ChatBubble({ message, participantName }: { message: Message; participantName: string | null }) {
  const isAI = message.role === 'ai';
  const initial = participantName ? participantName[0].toUpperCase() : '?';

  return (
    <div className={`flex items-end gap-3 message-in ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
        isAI
          ? 'bg-gradient-to-br from-brand-500 to-violet-600'
          : 'bg-gradient-to-br from-blue-500 to-cyan-500'
      }`}>
        {isAI
          ? <Sparkles className="w-4 h-4 text-white" />
          : <span className="text-white text-xs font-bold">{initial}</span>
        }
      </div>

      {/* Bubble */}
      <div className={`flex flex-col gap-2 ${isAI ? 'items-start' : 'items-end'} max-w-[85%]`}>
        <div className={isAI ? 'bubble-ai' : 'bubble-user'}>
          {isAI ? (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mt-1 [&>ul]:mb-1">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{message.content}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ─── Quick Reply Chips ────────────────────────────────────────────────────────
function QuickReplies({ replies, onSelect }: { replies: string[]; onSelect: (r: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1 ml-11">
      {replies.map((reply, i) => (
        <button
          key={i}
          onClick={() => onSelect(reply)}
          className="chip text-xs"
        >
          {reply}
        </button>
      ))}
    </div>
  );
}

// ─── Google Sign-In Modal ─────────────────────────────────────────────────────
function GoogleSignInModal({
  onSignIn,
  onSkip,
  isLoading,
}: {
  onSignIn: () => void;
  onSkip: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-fade-in-up"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(238,240,255,0.97) 100%)',
          border: '1.5px solid rgba(99,102,241,0.18)',
        }}
      >
        {/* Header gradient */}
        <div className="h-2 w-full bg-gradient-to-r from-brand-500 via-violet-500 to-blue-500" />

        <div className="p-8 flex flex-col items-center text-center gap-5">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-xl">
            <Sparkles className="w-8 h-8 text-white" />
          </div>

          <div>
            <h2 className="text-xl font-black text-gray-900 mb-1">Welcome to EventMind AI</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Sign in with your Gmail so your chat history and feedback are saved — even if you switch devices.
            </p>
          </div>

          {/* Benefits */}
          <ul className="w-full text-left space-y-2">
            {[
              'Your data is saved across devices',
              'Personalised AI responses with your name',
              'Resume chats where you left off',
            ].map((b) => (
              <li key={b} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-brand-500 flex-shrink-0" />
                {b}
              </li>
            ))}
          </ul>

          {/* Google Sign-In Button */}
          <button
            id="google-signin-btn"
            onClick={onSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl font-semibold text-gray-700 bg-white border-2 border-gray-200 hover:border-brand-400 hover:shadow-lg hover:shadow-brand-100 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {isLoading ? 'Signing in...' : 'Continue with Google'}
          </button>

          {/* Skip */}
          <button
            id="skip-signin-btn"
            onClick={onSkip}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium"
          >
            Continue without signing in →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Signed-In Badge ──────────────────────────────────────────────────────────
function SignedInBadge({ name, email, photoURL }: { name: string; email: string; photoURL: string | null }) {
  return (
    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/40 px-3 py-1.5 rounded-full">
      {photoURL ? (
        <img src={photoURL} alt={name} className="w-5 h-5 rounded-full object-cover" />
      ) : (
        <User className="w-4 h-4 text-green-600 dark:text-green-400" />
      )}
      <span className="text-xs font-semibold text-green-700 dark:text-green-400 max-w-[100px] truncate">{name}</span>
    </div>
  );
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────
export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId') || undefined;
  const event = eventId ? getEventById(eventId) : undefined;

  // Auth state
  const { user: authUser, loading: authLoading, signIn } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authDecided, setAuthDecided] = useState(false); // whether user made a sign-in decision

  // Show sign-in modal once Firebase is loaded and user is not signed in
  useEffect(() => {
    if (!authLoading && !authDecided) {
      if (!authUser && isFirebaseConfigured()) {
        setShowSignIn(true);
      } else {
        setAuthDecided(true);
      }
    }
  }, [authLoading, authUser, authDecided]);

  // Use auth-linked session ID if available
  const { messages, isTyping, sendMessage, participantName, phase } = useChat(
    eventId,
    authUser?.sessionId,
    authUser?.displayName   // pre-fills name → skips name collection phase
  );

  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = (reply: string) => {
    const clean = reply.replace(/^[^\w\s]*\s*/, '').trim();
    sendMessage(clean || reply);
  };

  const lastAIMessage = [...messages].reverse().find(m => m.role === 'ai');

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signIn();
    } finally {
      setSigningIn(false);
      setShowSignIn(false);
      setAuthDecided(true);
    }
  };

  const handleSkipSignIn = () => {
    setShowSignIn(false);
    setAuthDecided(true);
  };

  return (
    <div className="flex flex-col h-screen relative overflow-hidden bg-slate-50 dark:bg-gray-950 transition-colors duration-500">
      {/* Google Sign-In Modal */}
      {showSignIn && (
        <GoogleSignInModal
          onSignIn={handleGoogleSignIn}
          onSkip={handleSkipSignIn}
          isLoading={signingIn}
        />
      )}

      {/* Premium Background Mesh */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-gradient-to-b from-white to-brand-50/30 dark:from-gray-950 dark:to-gray-900">
        <div className="absolute top-0 left-0 w-[40%] h-full bg-gradient-to-r from-brand-500/30 via-brand-400/10 to-transparent blur-[80px] animate-pulse-slow" />
        <div className="absolute top-0 right-0 w-[40%] h-full bg-gradient-to-l from-violet-500/30 via-violet-400/10 to-transparent blur-[80px]" />
      </div>

      <div className="flex flex-col h-full relative z-10 max-w-4xl mx-auto w-full shadow-2xl bg-white/40 dark:bg-gray-950/40 backdrop-blur-3xl border-x border-white/20 dark:border-white/5">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg animate-glow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white text-base leading-none">EventMind AI</h1>
              <p className="text-xs text-brand-600 dark:text-brand-400 font-medium mt-1">
                {event ? event.name : participantName ? `Chatting as ${participantName}` : 'Event Assistant'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Signed-in badge */}
            {authUser && (
              <SignedInBadge
                name={authUser.displayName}
                email={authUser.email}
                photoURL={authUser.photoURL}
              />
            )}

            <div className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border border-white/20 dark:border-white/5">
              <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-bold tracking-wide">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                LIVE
              </span>
            </div>
          </div>
        </header>

      {/* Messages area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-5 scrollbar-hide">
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 animate-fade-in-up">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-xl animate-float">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">EventMind AI</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Starting your session...</p>
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg) => (
          <div key={msg.id}>
            <ChatBubble message={msg} participantName={authUser?.displayName || participantName} />
            {msg.quickReplies && msg.quickReplies.length > 0 && (
              <QuickReplies replies={msg.quickReplies} onSelect={handleQuickReply} />
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="mt-2">
            <TypingIndicator />
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Input area */}
      <footer className="px-6 pb-8 pt-4 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-gray-950 dark:via-gray-950/90 relative z-20 mt-auto">

        {/* Sign-in nudge if not authenticated */}
        {!authUser && authDecided && isFirebaseConfigured() && (
          <div className="flex items-center justify-center gap-2 mb-3">
            <button
              id="nudge-signin-btn"
              onClick={() => setShowSignIn(true)}
              className="flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors font-medium"
            >
              <Mail className="w-3.5 h-3.5" />
              Sign in with Google to save your chat history
            </button>
          </div>
        )}

        <div className="relative flex items-end gap-3 max-w-3xl mx-auto">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKey}
              placeholder={phase === 'name' ? 'Type your name...' : 'Type a message...'}
              rows={1}
              className="chat-input min-h-[56px] max-h-32 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]"
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
            disabled={!inputValue.trim() || sending}
            id="send-button"
            className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-xl ${
              inputValue.trim() && !sending
                ? 'bg-gradient-to-r from-brand-500 to-violet-600 text-white hover:scale-105 hover:shadow-brand-500/40 active:scale-95'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-200 dark:border-gray-700'
            }`}
          >
            <Send className="w-5 h-5 ml-1" />
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4 font-medium tracking-wide">
          {authUser
            ? `✅ Signed in as ${authUser.email} · Data saved`
            : '🔒 Your feedback is anonymous · EventMind AI'}
        </p>
      </footer>
      </div>
    </div>
  );
}
