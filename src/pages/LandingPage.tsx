import React from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Sparkles, Wifi, Utensils, Zap, MessageCircle, Scan, ChevronRight, ArrowRight, Bot, TrendingUp, Users, CheckCircle, Star } from 'lucide-react';

// ─── Landing Page ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const chatUrl = `${window.location.origin}/chat`;

  const features = [
    { icon: MessageCircle, title: 'Natural Conversation', desc: 'Participants chat naturally — no boring forms or surveys.', color: 'from-blue-500 to-cyan-500' },
    { icon: TrendingUp, title: 'Real-time Analytics', desc: 'Issues appear on the dashboard the moment they\'re reported.', color: 'from-violet-500 to-purple-600' },
    { icon: Bot, title: 'AI Issue Detection', desc: 'AI automatically detects, categorizes, and prioritizes every issue.', color: 'from-brand-500 to-indigo-600' },
    { icon: Users, title: 'Duplicate Merging', desc: 'Same issue from 20 people shows as 1 ticket, not 20.', color: 'from-orange-400 to-pink-500' },
    { icon: CheckCircle, title: 'Auto Follow-up', desc: 'AI follows up to verify if reported issues were resolved.', color: 'from-green-400 to-emerald-600' },
    { icon: Star, title: 'Hindsight Memory', desc: 'Learns from every event to improve future ones automatically.', color: 'from-yellow-400 to-orange-500' },
  ];

  const steps = [
    { label: 'Participant', icon: '👤', desc: 'Scans QR at venue' },
    { label: 'QR Scan', icon: '📱', desc: 'Opens chat instantly' },
    { label: 'AI Conversation', icon: '🤖', desc: 'Natural dialogue' },
    { label: 'Smart Ticket', icon: '🎫', desc: 'Issue extracted & filed' },
    { label: 'Dashboard', icon: '📊', desc: 'Management notified' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-gray-100/50 dark:border-gray-800/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white">EventMind AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="btn-outline text-sm py-2 px-4 hidden sm:inline-flex">
              Organizer Dashboard
            </Link>
            <Link to="/chat" className="btn-gradient text-sm py-2 px-4">
              Try Chat →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center overflow-hidden">
        {/* Background orbs */}
        <div className="orb w-96 h-96 bg-brand-400 -top-24 -left-24 animate-float" />
        <div className="orb w-80 h-80 bg-violet-400 top-1/2 -right-20 animate-float" style={{ animationDelay: '2s' }} />
        <div className="orb w-64 h-64 bg-blue-400 bottom-0 left-1/3 animate-float" style={{ animationDelay: '4s' }} />

        <div className="relative z-10 max-w-4xl mx-auto animate-fade-in-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700/50 rounded-full text-brand-700 dark:text-brand-300 text-sm font-medium mb-8 animate-scale-in">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            AI-Powered Event Intelligence Platform
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight mb-6 text-gray-900 dark:text-white">
            Improve Every Event
            <br />
            <span className="gradient-text">with AI Conversations</span>
          </h1>

          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Instead of filling boring feedback forms, participants simply{' '}
            <strong className="text-gray-700 dark:text-gray-300">scan a QR code and chat</strong>{' '}
            with EventMind AI — helping organizers resolve problems in real time.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/chat" id="cta-start-chat" className="btn-gradient flex items-center gap-2 text-base">
              <MessageCircle className="w-5 h-5" />
              Start Chat
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/dashboard" id="cta-dashboard" className="btn-outline flex items-center gap-2 text-base">
              <TrendingUp className="w-5 h-5" />
              Organizer Dashboard
            </Link>
            <Link to="/qr" id="cta-qr" className="flex items-center gap-2 text-gray-500 hover:text-brand-600 transition-colors text-base font-medium">
              <Scan className="w-5 h-5" />
              Show QR Code
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Flow diagram */}
        <div className="relative z-10 mt-20 w-full max-w-4xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="card shadow-2xl">
            <h3 className="text-center text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-8">How It Works</h3>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {steps.map((step, i) => (
                <React.Fragment key={step.label}>
                  <div className="flex flex-col items-center gap-2 group">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-50 to-violet-50 dark:from-brand-900/30 dark:to-violet-900/30 flex items-center justify-center text-3xl border border-brand-100 dark:border-brand-800/30 shadow-sm group-hover:scale-110 transition-transform duration-300">
                      {step.icon}
                    </div>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{step.label}</span>
                    <span className="text-xs text-gray-400 text-center max-w-[80px]">{step.desc}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-brand-300 dark:text-brand-700 flex-shrink-0 hidden sm:block" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* QR Demo section */}
      <section className="py-20 px-6 bg-gradient-to-br from-brand-50 to-violet-50 dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 font-semibold text-sm mb-4">
                <Scan className="w-4 h-4" />
                QR Code Experience
              </div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-6">
                Scan Once,<br />
                <span className="gradient-text">Chat Instantly</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg mb-8 leading-relaxed">
                Display this QR code on a screen at your venue. Participants scan it with their phone and the AI chat opens immediately — no app download, no login required.
              </p>
              <div className="space-y-4">
                {['📍 No app download needed', '🔒 Anonymous & private', '📱 Works on any smartphone', '⚡ Issues reach organizers in seconds'].map(item => (
                  <div key={item} className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <div className="card shadow-2xl max-w-sm w-full text-center p-8 animate-float">
                <div className="text-4xl mb-3">📱</div>
                <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-1">Need Help?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Scan this QR and chat with EventMind AI
                </p>
                <div className="flex justify-center p-4 bg-white rounded-2xl border border-gray-100 mb-4">
                  <QRCodeSVG value={chatUrl} size={160} fgColor="#4f46e5" level="M" />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  or visit: <span className="text-brand-600 font-medium">/chat</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
              Everything You Need to<br />
              <span className="gradient-text">Run a Perfect Event</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto">
              EventMind AI combines conversational AI with smart analytics to give organizers superpowers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, i) => (
              <div
                key={feat.title}
                className="card group hover:scale-105 transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${feat.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feat.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{feat.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gradient-to-br from-brand-500 via-violet-600 to-blue-600 relative overflow-hidden">
        <div className="orb w-96 h-96 bg-white -top-32 -right-32" />
        <div className="orb w-64 h-64 bg-white bottom-0 -left-16" />
        <div className="max-w-3xl mx-auto text-center relative z-10 animate-fade-in-up">
          <h2 className="text-4xl font-black text-white mb-4">
            Ready to Transform Your Event?
          </h2>
          <p className="text-blue-100 text-lg mb-8">
            Replace boring feedback forms with AI conversations. Get started in minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/chat" className="bg-white text-brand-600 font-bold rounded-2xl px-8 py-4 hover:bg-gray-50 transition-all hover:scale-105 shadow-xl flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Try Participant Chat
            </Link>
            <Link to="/dashboard" className="border-2 border-white/30 text-white font-bold rounded-2xl px-8 py-4 hover:bg-white/10 transition-all flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              View Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-gray-700 dark:text-gray-300 text-sm">EventMind AI</span>
          </div>
          <p className="text-xs text-gray-400">AI-powered event intelligence · Built with Gemini AI</p>
        </div>
      </footer>
    </div>
  );
}
