import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { submitFeedback, FeedbackPayload, DEFAULT_DEVELOPER_EMAIL } from '../services/feedbackService';
import { XIcon, CheckCircleIcon } from './icons/Icons';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoute?: string;
}

const CATEGORIES: { id: FeedbackPayload['category']; label: string; icon: string; desc: string }[] = [
  { id: 'Feature Request', label: 'Feature Request', icon: '💡', desc: 'New ideas or improvements' },
  { id: 'Bug / Issue', label: 'Bug / Issue', icon: '🐛', desc: 'Something not working properly' },
  { id: 'Driver Experience', label: 'Driver Experience', icon: '🚗', desc: 'Trip, odometer, or mobile flow' },
  { id: 'System & Speed', label: 'System & Speed', icon: '⚡', desc: 'Performance or connectivity' },
  { id: 'General Feedback', label: 'General Feedback', icon: '💬', desc: 'Thoughts, praise, or suggestions' },
];

const RATING_LABELS: Record<number, string> = {
  1: 'Poor — Needs urgent fix',
  2: 'Fair — Has noticeable flaws',
  3: 'Good — Works well overall',
  4: 'Great — Very smooth & helpful',
  5: 'Exceptional — Exceeds expectations',
};

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, currentRoute = '/' }) => {
  const { currentUser, activeTenant } = useAppContext();

  const [category, setCategory] = useState<FeedbackPayload['category']>('Feature Request');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a brief feedback title.');
      return;
    }
    if (!message.trim()) {
      setErrorMsg('Please describe your feedback or suggestion.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const payload: FeedbackPayload = {
        category,
        rating,
        title: title.trim(),
        message: message.trim(),
        userName: currentUser?.name || 'Anonymous User',
        userEmail: currentUser?.email || 'N/A',
        userRole: currentUser?.role || 'user',
        currentRoute,
        tenantId: activeTenant?.id || 'default',
        systemName: 'Armada Flow',
      };

      const result = await submitFeedback(payload);
      setIsSubmitting(false);
      setIsSubmitted(true);
      setStatusMessage(result.message);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || 'Failed to submit feedback. Please try again.');
    }
  };

  const handleResetAndClose = () => {
    setIsSubmitted(false);
    setTitle('');
    setMessage('');
    setRating(5);
    setCategory('Feature Request');
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-5 sm:p-6 text-white flex items-center justify-between relative">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">💬</span>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Share Your Feedback
              </h2>
            </div>
            <p className="text-xs text-indigo-200/90 mt-1">
              We appreciate your suggestions. Help us enhance the Armada Flow experience.
            </p>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-2 rounded-xl text-indigo-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        {isSubmitted ? (
          <div className="p-8 sm:p-10 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircleIcon className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">
              Thank You for Your Feedback!
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              Your feedback has been submitted successfully. Our team reviews suggestions regularly to enhance the system for everyone.
            </p>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs space-y-1.5">
              <div className="text-slate-500 font-semibold">Submission Summary:</div>
              <div className="font-bold text-slate-800">
                {category} · {rating} ★ &quot;{title}&quot;
              </div>
              <div className="text-[11px] text-slate-500">
                Submitted by: <span className="font-semibold text-slate-700">{currentUser?.name}</span> ({currentUser?.role})
              </div>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-sm cursor-pointer"
              >
                Close & Return
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
            {/* Identity context indicator */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="font-bold text-slate-800">{currentUser?.name || 'User'}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 capitalize">{currentUser?.role || 'Guest'}</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">{currentRoute}</span>
            </div>

            {/* Category selection */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                Feedback Category <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      category === cat.id
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 line-clamp-1">{cat.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 1-5 Star Rating */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Overall System Rating <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs font-semibold text-amber-800">
                  {RATING_LABELS[hoverRating || rating]}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-amber-50/50 border border-amber-200/70 rounded-2xl">
                {[1, 2, 3, 4, 5].map(star => {
                  const isActive = (hoverRating !== null ? hoverRating : rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => setRating(star)}
                      className="text-2xl transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                      aria-label={`${star} Star`}
                    >
                      {isActive ? (
                        <span className="text-amber-500">★</span>
                      ) : (
                        <span className="text-slate-300">☆</span>
                      )}
                    </button>
                  );
                })}
                <span className="ml-auto text-xs font-black text-amber-900">
                  {rating} / 5 Stars
                </span>
              </div>
            </div>

            {/* Title / Summary */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                Subject / Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Add quick odometer shortcut on mobile"
                maxLength={100}
                required
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-900"
              />
            </div>

            {/* Detailed Message */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Details & Suggestions <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {message.length} chars
                </span>
              </div>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Explain what happened, what could be improved, or how this feature would help your daily workflow..."
                rows={4}
                required
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-900 resize-y"
              ></textarea>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetAndClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Submitting Feedback...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Feedback</span>
                    <span>&rarr;</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
