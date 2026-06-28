import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star, CheckCircle2, ChevronRight } from 'lucide-react';
import { syncParticipantByEmail } from '../services/issueService';
import { submitFeedback } from '../services/feedbackService';
import { getEventById } from '../services/eventService';
import { v4 as uuidv4 } from 'uuid';
import type { IssueCategory } from '../types';

// ─── Star Rating Component ────────────────────────────────────────────────────
function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label?: string }) {
  const [hovered, setHovered] = useState(0);
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-sm text-gray-500">{label}</p>}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            type="button"
            key={star}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
          >
            <Star
              className={`w-9 h-9 transition-all duration-150 ${
                star <= (hovered || value)
                  ? 'fill-amber-400 text-amber-400 drop-shadow-sm'
                  : 'text-gray-300 fill-gray-100'
              }`}
            />
          </button>
        ))}
        {(hovered || value) > 0 && (
          <span className="ml-2 text-sm font-medium text-amber-600">
            {labels[hovered || value]}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Radio Option ─────────────────────────────────────────────────────────────
function RadioOption({ name, value, label, selected, onChange }: {
  name: string; value: string; label: string; selected: boolean; onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-850 cursor-pointer transition-colors group">
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
        selected ? 'border-black bg-black dark:border-zinc-500 dark:bg-zinc-500' : 'border-gray-400 group-hover:border-gray-600 dark:group-hover:border-zinc-400'
      }`}>
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
      <input type="radio" name={name} value={value} checked={selected} onChange={onChange} className="sr-only" />
      <span className={`text-sm ${selected ? 'text-black dark:text-zinc-200 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>{label}</span>
    </label>
  );
}

// ─── Checkbox Option ──────────────────────────────────────────────────────────
function CheckboxOption({ value, label, selected, onChange }: {
  value: string; label: string; selected: boolean; onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-850 cursor-pointer transition-colors group">
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
        selected ? 'border-black bg-black dark:border-zinc-500 dark:bg-zinc-500' : 'border-gray-400 group-hover:border-gray-600 dark:group-hover:border-zinc-400'
      }`}>
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`text-sm ${selected ? 'text-black dark:text-zinc-200 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>{label}</span>
    </label>
  );
}

// ─── Form Section Card ────────────────────────────────────────────────────────
function FormCard({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm border ${accent ? 'border-t-4 border-t-black dark:border-t-zinc-700 border-gray-200 dark:border-gray-800' : 'border-gray-200 dark:border-gray-800'} overflow-hidden`}>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Main Form Page ───────────────────────────────────────────────────────────
export default function ReportFormPage() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId') || undefined;
  const prefilledLocation = searchParams.get('location') || '';
  const event = eventId ? getEventById(eventId) : undefined;
  const [sessionId] = useState(() => sessionStorage.getItem('eventmind_session') || uuidv4());

  // ── Form State ──
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState(prefilledLocation);
  const [overallRating, setOverallRating] = useState(0);
  const [venueRating, setVenueRating] = useState(0);
  const [foodRating, setFoodRating] = useState(0);
  const [wifiRating, setWifiRating] = useState(0);
  const [overallExperience, setOverallExperience] = useState('');
  const [issueCategory, setIssueCategory] = useState<string[]>([]);
  const [likes, setLikes] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [improvements, setImprovements] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const TOTAL_PAGES = 2;

  const toggleCategory = (val: string) => {
    setIssueCategory(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let activeSessionId = sessionId;
    if (email.trim()) {
      activeSessionId = await syncParticipantByEmail(email, name || 'Anonymous');
      sessionStorage.setItem('eventmind_session', activeSessionId);
    } else if (!sessionStorage.getItem('eventmind_session')) {
      sessionStorage.setItem('eventmind_session', sessionId);
    }

    const participantName = name.trim() || 'Anonymous';
    const fullDescription = [
      likes && `✅ Liked: ${likes}`,
      dislikes && `❌ Disliked: ${dislikes}`,
      improvements && `💡 Improvements: ${improvements}`,
      additionalComments && `📝 Additional: ${additionalComments}`,
    ].filter(Boolean).join('\n');

    const primaryCategory = issueCategory[0] as IssueCategory || 'other';

    await submitFeedback({
      eventId,
      participantName,
      participantSessionId: activeSessionId,
      location: location || 'Unknown',
      overallRating,
      overallExperience,
      venueRating: venueRating > 0 ? venueRating : undefined,
      foodRating: foodRating > 0 ? foodRating : undefined,
      wifiRating: wifiRating > 0 ? wifiRating : undefined,
      likes,
      dislikes,
      improvements,
      recommendation,
      additionalComments,
      issueCategory,
      sentiment: overallRating >= 4 ? 'positive' : overallRating === 3 ? 'neutral' : 'negative',
    });
    setLoading(false);
    setSubmitted(true);
  };

  const handleResetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setLocation(prefilledLocation);
    setOverallRating(0);
    setVenueRating(0);
    setFoodRating(0);
    setWifiRating(0);
    setOverallExperience('');
    setIssueCategory([]);
    setLikes('');
    setDislikes('');
    setImprovements('');
    setRecommendation('');
    setAdditionalComments('');
    setPage(1);
    setSubmitted(false);
  };

  // ── Submitted ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-10 max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-zinc-100 text-zinc-900 dark:bg-zinc-850 dark:text-zinc-200 flex items-center justify-center mb-5 mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-normal text-gray-800 dark:text-gray-100 mb-3">Response recorded</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm leading-relaxed">
            Your feedback has been submitted to the organizing team. Thank you for helping us improve the event experience!
          </p>
          <button
            type="button"
            onClick={handleResetForm}
            className="inline-block px-6 py-2.5 bg-black text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-md font-medium text-sm hover:bg-neutral-800 transition-colors focus:outline-none"
          >
            Submit another response
          </button>
        </div>
      </div>
    );
  }

  const issueOptions = [
    { value: 'wifi', label: '📶 Wi-Fi / Internet Connectivity' },
    { value: 'food', label: '🍕 Food & Beverages' },
    { value: 'power', label: '🔌 Power & Charging Stations' },
    { value: 'venue', label: '🏢 Venue & Space' },
    { value: 'sessions', label: '🎤 Sessions / Talks / Workshops' },
    { value: 'registration', label: '📋 Registration / Check-in' },
    { value: 'volunteers', label: '🙋 Volunteers / Staff Support' },
    { value: 'washrooms', label: '🚻 Washrooms / Restrooms' },
    { value: 'announcement', label: '📢 Announcements / Communication' },
    { value: 'other', label: '💬 Other' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 py-6 px-4 font-[sans-serif]">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ── Header Banner ── */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border-t-8 border-t-black dark:border-t-zinc-700 border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <h1 className="text-3xl font-normal text-gray-800 dark:text-gray-100 mb-2">
              {event ? `${event.name} — Feedback Form` : 'Event Feedback Form'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Help us improve your event experience by sharing your honest feedback.
              All responses are anonymous and will be reviewed by the organizing team.
            </p>
            {prefilledLocation && (
              <div className="mt-3 inline-flex items-center gap-1.5 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200 text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700">
                📍 Location: {prefilledLocation}
              </div>
            )}
          </div>
          {/* Progress bar */}
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-850 flex items-center gap-3">
            <span className="text-xs text-gray-500">Page {page} of {TOTAL_PAGES}</span>
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-black dark:bg-zinc-500 rounded-full transition-all duration-500"
                style={{ width: `${(page / TOTAL_PAGES) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Required notice ── */}
        <p className="text-xs text-gray-500 text-right px-1">
          <span className="text-red-500">*</span> Required
        </p>

        <form onSubmit={handleSubmit}>

          {/* ════════════ PAGE 1 — Basic Details ════════════ */}
          {page === 1 && (
            <>
              {/* Basic Info */}
              <FormCard accent>
                <h2 className="text-base font-medium text-gray-800 mb-4">Section 1: Basic Details</h2>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your answer"
                      className="w-full border-0 border-b-2 border-gray-300 dark:border-gray-700 focus:border-black dark:focus:border-zinc-500 outline-none py-2 text-sm text-gray-800 dark:text-gray-100 bg-transparent transition-colors placeholder-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full border-0 border-b-2 border-gray-300 dark:border-gray-700 focus:border-black dark:focus:border-zinc-500 outline-none py-2 text-sm text-gray-800 dark:text-gray-100 bg-transparent transition-colors placeholder-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 00000 00000"
                      className="w-full border-0 border-b-2 border-gray-300 dark:border-gray-700 focus:border-black dark:focus:border-zinc-500 outline-none py-2 text-sm text-gray-800 dark:text-gray-100 bg-transparent transition-colors placeholder-gray-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1.5">
                      Current Location at Venue <span className="text-gray-400">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="e.g. Hall A, Cafeteria, Registration Desk"
                      className="w-full border-0 border-b-2 border-gray-300 dark:border-gray-700 focus:border-black dark:focus:border-zinc-500 outline-none py-2 text-sm text-gray-800 dark:text-gray-100 bg-transparent transition-colors placeholder-gray-300"
                    />
                  </div>
                </div>
              </FormCard>

              {/* Overall Experience */}
              <FormCard>
                <h3 className="text-sm font-medium text-gray-800 mb-4">
                  How would you describe your overall experience? <span className="text-red-500">*</span>
                </h3>
                <div className="space-y-1">
                  {[
                    { v: 'excellent', l: '😄 Excellent — Everything was outstanding!' },
                    { v: 'good', l: '😊 Good — Had a great time overall' },
                    { v: 'average', l: '😐 Average — It was okay, room for improvement' },
                    { v: 'poor', l: '😕 Poor — Several things didn\'t meet my expectations' },
                    { v: 'very-poor', l: '😞 Very Poor — Quite disappointed' },
                  ].map(opt => (
                    <RadioOption
                      key={opt.v}
                      name="overall-experience"
                      value={opt.v}
                      label={opt.l}
                      selected={overallExperience === opt.v}
                      onChange={() => setOverallExperience(opt.v)}
                    />
                  ))}
                </div>
              </FormCard>

              {/* Overall Rating */}
              <FormCard>
                <h3 className="text-sm font-medium text-gray-800 mb-4">
                  Overall Event Rating <span className="text-red-500">*</span>
                </h3>
                <StarRating value={overallRating} onChange={setOverallRating} label="1 = Poor, 5 = Excellent" />
              </FormCard>
            </>
          )}

          {/* ════════════ PAGE 2 — Ratings & Feedback ════════════ */}
          {page === 2 && (
            <>
              {/* Category ratings */}
              <FormCard accent>
                <h2 className="text-base font-medium text-gray-800 mb-1">Section 2: Detailed Ratings</h2>
                <p className="text-sm text-gray-500 mb-5">Rate each aspect of the event</p>
                <div className="space-y-6 divide-y divide-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">🏢 Venue & Facilities</p>
                    <StarRating value={venueRating} onChange={setVenueRating} />
                  </div>
                  <div className="pt-5">
                    <p className="text-sm font-medium text-gray-700 mb-2">🍕 Food & Beverages</p>
                    <StarRating value={foodRating} onChange={setFoodRating} />
                  </div>
                  <div className="pt-5">
                    <p className="text-sm font-medium text-gray-700 mb-2">📶 Wi-Fi & Internet</p>
                    <StarRating value={wifiRating} onChange={setWifiRating} />
                  </div>
                </div>
              </FormCard>

              {/* What did you like */}
              <FormCard>
                <h3 className="text-sm font-medium text-gray-800 mb-1">
                  What did you like most about the event?
                </h3>
                <p className="text-xs text-gray-400 mb-3">
                  e.g. Great speakers, smooth check-in, tasty food, helpful volunteers...
                </p>
                <textarea
                  value={likes}
                  onChange={e => setLikes(e.target.value)}
                  placeholder="Your answer"
                  rows={3}
                  className="w-full border-0 border-b-2 border-gray-300 dark:border-gray-700 focus:border-black dark:focus:border-zinc-500 outline-none py-2 text-sm text-gray-800 dark:text-gray-100 bg-transparent transition-colors resize-none placeholder-gray-300"
                />
              </FormCard>

              {/* What did you dislike */}
              <FormCard>
                <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">
                  What did you dislike or found disappointing?
                </h3>
                <p className="text-xs text-gray-400 mb-3">
                  e.g. Wi-Fi was too slow, long queues at food stalls, not enough seating...
                </p>
                <textarea
                  value={dislikes}
                  onChange={e => setDislikes(e.target.value)}
                  placeholder="Your answer"
                  rows={3}
                  className="w-full border-0 border-b-2 border-gray-300 dark:border-gray-700 focus:border-black dark:focus:border-zinc-500 outline-none py-2 text-sm text-gray-800 dark:text-gray-100 bg-transparent transition-colors resize-none placeholder-gray-300"
                />
              </FormCard>

              {/* Issue categories */}
              <FormCard accent>
                <h2 className="text-base font-medium text-gray-800 mb-1">Issues & Improvements</h2>
                <p className="text-sm text-gray-500 mb-4">Select all areas you faced issues with</p>
                <div className="space-y-1">
                  {issueOptions.map(opt => (
                    <CheckboxOption
                      key={opt.value}
                      value={opt.value}
                      label={opt.label}
                      selected={issueCategory.includes(opt.value)}
                      onChange={() => toggleCategory(opt.value)}
                    />
                  ))}
                </div>
              </FormCard>

              {/* Improvements */}
              <FormCard>
                <h3 className="text-sm font-medium text-gray-800 mb-1">
                  What improvements would you suggest?
                </h3>
                <p className="text-xs text-gray-400 mb-3">
                  e.g. More power outlets in Hall A, better signage, additional Wi-Fi routers near registration...
                </p>
                <textarea
                  value={improvements}
                  onChange={e => setImprovements(e.target.value)}
                  placeholder="Share your suggestions..."
                  rows={4}
                  className="w-full border-0 border-b-2 border-gray-300 dark:border-gray-700 focus:border-black dark:focus:border-zinc-500 outline-none py-2 text-sm text-gray-800 dark:text-gray-100 bg-transparent transition-colors resize-none placeholder-gray-300"
                />
              </FormCard>

              {/* Recommend */}
              <FormCard>
                <h3 className="text-sm font-medium text-gray-800 mb-4">
                  Would you recommend this event to others?
                </h3>
                <div className="space-y-1">
                  {[
                    { v: 'definitely', l: '✅ Definitely yes!' },
                    { v: 'probably', l: '👍 Probably yes' },
                    { v: 'not-sure', l: '🤔 Not sure' },
                    { v: 'probably-not', l: '👎 Probably not' },
                    { v: 'definitely-not', l: '❌ Definitely not' },
                  ].map(opt => (
                    <RadioOption
                      key={opt.v}
                      name="recommendation"
                      value={opt.v}
                      label={opt.l}
                      selected={recommendation === opt.v}
                      onChange={() => setRecommendation(opt.v)}
                    />
                  ))}
                </div>
              </FormCard>

              {/* Additional comments */}
              <FormCard>
                <h3 className="text-sm font-medium text-gray-800 mb-1">
                  Any other comments or feedback?
                </h3>
                <p className="text-xs text-gray-400 mb-3">
                  Feel free to share anything else you'd like the organizers to know.
                </p>
                <textarea
                  value={additionalComments}
                  onChange={e => setAdditionalComments(e.target.value)}
                  placeholder="Your answer"
                  rows={4}
                  className="w-full border-0 border-b-2 border-gray-300 dark:border-gray-700 focus:border-black dark:focus:border-zinc-500 outline-none py-2 text-sm text-gray-800 dark:text-gray-100 bg-transparent transition-colors resize-none placeholder-gray-300"
                />
              </FormCard>
            </>
          )}

          {/* ── Navigation Buttons ── */}
          <div className="flex items-center justify-between pt-2 pb-8">
            {page > 1 ? (
              <button
                type="button"
                onClick={() => setPage(p => p - 1)}
                className="px-6 py-2.5 text-sm font-medium text-black hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-md transition-colors"
              >
                Back
              </button>
            ) : <div />}

            {page < TOTAL_PAGES ? (
              <button
                type="button"
                onClick={() => {
                  if (page === 1 && overallRating === 0) {
                    alert('Please provide an overall rating before continuing.');
                    return;
                  }
                  setPage(p => p + 1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-2 px-7 py-2.5 bg-black text-white dark:bg-zinc-850 dark:hover:bg-zinc-750 rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                onClick={handleSubmit}
                className="flex items-center gap-2 px-7 py-2.5 bg-black text-white dark:bg-zinc-850 dark:hover:bg-zinc-750 rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm disabled:opacity-60"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Submit'}
              </button>
            )}
          </div>

          {/* ── Clear form ── */}
          {page === 1 && (
            <div className="text-center pb-6">
              <button
                type="button"
                onClick={() => {
                  setName(''); setEmail(''); setPhone(''); setOverallRating(0); setOverallExperience('');
                }}
                className="text-xs text-zinc-600 hover:underline dark:text-zinc-400"
              >
                Clear form
              </button>
              <p className="text-xs text-gray-400 mt-2">
                🔒 Anonymous · Powered by EventMind AI
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
