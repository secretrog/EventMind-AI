import { QRCodeSVG } from 'qrcode.react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Wifi, Utensils, Zap, MessageCircle, Star, AlertCircle, ThumbsUp, MapPin, Calendar } from 'lucide-react';
import { getEventById } from '../services/eventService';

export default function QRPage() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId') || undefined;
  const event = eventId ? getEventById(eventId) : undefined;

  const chatUrl = eventId
    ? `${window.location.origin}/chat?eventId=${eventId}`
    : `${window.location.origin}/chat`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-brand-950 to-gray-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute w-96 h-96 bg-brand-500/20 rounded-full blur-3xl top-1/4 left-1/4 animate-pulse-slow" />
      <div className="absolute w-80 h-80 bg-violet-500/20 rounded-full blur-3xl bottom-1/4 right-1/4 animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

      {/* Header */}
      <div className="relative z-10 text-center mb-10 animate-fade-in-up">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-xl animate-glow">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="text-3xl font-black text-white">EventMind AI</span>
        </div>

        {event ? (
          <div className="space-y-3 mb-8">
            <h1 className="text-5xl sm:text-6xl font-black text-white leading-tight">{event.name}</h1>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {event.venue && (
                <span className="flex items-center gap-1.5 text-lg text-brand-300 font-semibold">
                  <MapPin className="w-5 h-5" /> {event.venue}
                </span>
              )}
              {event.date && (
                <span className="flex items-center gap-1.5 text-lg text-violet-300 font-semibold">
                  <Calendar className="w-5 h-5" /> {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            {event.description && (
              <p className="text-xl text-gray-400 mt-1">{event.description}</p>
            )}
            <p className="text-lg text-gray-400 mt-2">Scan the QR Code to chat with EventMind AI</p>
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            <h1 className="text-5xl sm:text-6xl font-black text-white leading-tight">Need Help?</h1>
            <p className="text-3xl text-brand-300 font-bold">Have an issue? Want to appreciate?</p>
            <p className="text-xl text-gray-400 mt-2">Scan the QR Code and chat with EventMind AI</p>
          </div>
        )}

        {/* Topic pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-8 max-w-2xl">
          {[
            { icon: Wifi, label: 'Wi-Fi Issues', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
            { icon: Utensils, label: 'Food & Drinks', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
            { icon: Zap, label: 'Power Outlets', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
            { icon: AlertCircle, label: 'Report Problem', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
            { icon: ThumbsUp, label: 'Appreciation', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
            { icon: Star, label: 'Suggestions', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
          ].map(item => (
            <div key={item.label} className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-medium ${item.color}`}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* QR Code Card */}
      <div className="relative z-10 animate-float">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-10 shadow-2xl text-center">
          {/* Glow behind QR */}
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-brand-500/30 blur-2xl rounded-2xl scale-110" />
            <div className="relative bg-white rounded-2xl p-5 shadow-2xl">
              <QRCodeSVG
                value={chatUrl}
                size={220}
                fgColor="#4f46e5"
                bgColor="#ffffff"
                level="H"
                includeMargin={false}
              />
            </div>
          </div>

          <div className="mt-6">
            <p className="text-white text-lg font-bold mb-1">📱 Scan to Chat</p>
            <p className="text-gray-400 text-sm mb-3">Your feedback is 100% anonymous</p>
            <div className="flex items-center justify-center gap-1 text-xs text-brand-400 font-mono bg-brand-900/30 rounded-full px-4 py-1.5 border border-brand-700/30">
              <MessageCircle className="w-3 h-3" />
              {chatUrl}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom message */}
      <div className="relative z-10 mt-10 text-center animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
        <p className="text-gray-500 text-sm">🔒 Your identity is never revealed to organizers</p>
        <p className="text-gray-600 text-xs mt-1">Powered by EventMind AI · Gemini AI</p>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-brand-400/30 rounded-full"
            style={{
              left: `${10 + i * 15}%`,
              bottom: '-20px',
              animation: `particleFloat ${6 + i * 1.5}s ease-in-out infinite`,
              animationDelay: `${i * 1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
