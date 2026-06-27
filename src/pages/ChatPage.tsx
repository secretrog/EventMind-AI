import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { getEventById } from '../services/eventService';
import type { Message } from '../types';

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



// ─── Main Chat Page ───────────────────────────────────────────────────────────
export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId') || undefined;
  const event = eventId ? getEventById(eventId) : undefined;
  const { messages, isTyping, sendMessage, participantName, phase } = useChat(eventId);
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
    // Strip emoji prefixes for cleaner messages
    const clean = reply.replace(/^[^\w\s]*\s*/, '').trim();
    sendMessage(clean || reply);
  };

  const lastAIMessage = [...messages].reverse().find(m => m.role === 'ai');

  return (
    <div className="flex flex-col h-screen relative overflow-hidden bg-slate-50 dark:bg-gray-950 transition-colors duration-500">
      {/* Premium Background Mesh */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-400/20 dark:bg-brand-600/20 blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-400/20 dark:bg-violet-600/20 blur-[120px]" />
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

          <div className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border border-white/20 dark:border-white/5">
            <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-bold tracking-wide">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              LIVE
            </span>
          </div>
        </header>

      {/* Messages area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-5 scrollbar-hide">
        {/* Empty state suggestions */}
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
        {messages.map((msg, i) => (
          <div key={msg.id}>
            <ChatBubble message={msg} participantName={participantName} />
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
          🔒 Your feedback is anonymous · EventMind AI
        </p>
      </footer>
      </div>
    </div>
  );
}
