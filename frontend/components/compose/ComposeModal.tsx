'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { campaignsApi, sendersApi } from '@/lib/api';
import { parseCSV, parseEmailsFromText } from '@/lib/utils';
import { Sender, AdaptivePlanPreview } from '@/types';
import { showToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { n: 1, label: 'Compose' },
  { n: 2, label: 'Recipients' },
  { n: 3, label: 'Schedule' },
  { n: 4, label: 'Preview' },
];

export default function ComposeModal({ isOpen, onClose, onSuccess }: ComposeModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add Sender state
  const [showAddSender, setShowAddSender] = useState(false);
  const [newSenderName, setNewSenderName] = useState('');
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderHost, setNewSenderHost] = useState('smtp.gmail.com');
  const [newSenderPort, setNewSenderPort] = useState(587);
  const [newSenderUser, setNewSenderUser] = useState('');
  const [newSenderPass, setNewSenderPass] = useState('');
  const [newSenderSecure, setNewSenderSecure] = useState(false);
  const [newSenderHourlyLimit, setNewSenderHourlyLimit] = useState(100);
  const [addingSender, setAddingSender] = useState(false);

  const handleAddSender = async () => {
    if (!newSenderName || !newSenderEmail || !newSenderPass) {
      showToast('Name, Email, and Password / App Password are required', 'error');
      return;
    }
    setAddingSender(true);
    try {
      const response = await sendersApi.create({
        name: newSenderName,
        email: newSenderEmail,
        etherealUser: newSenderUser || newSenderEmail,
        etherealPass: newSenderPass,
        smtpHost: newSenderHost,
        smtpPort: Number(newSenderPort),
        smtpSecure: newSenderSecure,
        hourlyLimit: Number(newSenderHourlyLimit),
      });
      const newSender = response.sender;
      setSenders((prev) => [newSender, ...prev]);
      setSenderId(newSender.id);
      showToast('Custom SMTP Sender added successfully!', 'success');
      // Reset form
      setNewSenderName('');
      setNewSenderEmail('');
      setNewSenderUser('');
      setNewSenderPass('');
      setNewSenderHost('smtp.gmail.com');
      setNewSenderPort(587);
      setNewSenderSecure(false);
      setShowAddSender(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to add custom sender', 'error');
    } finally {
      setAddingSender(false);
    }
  };

  // Form state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [rawRecipients, setRawRecipients] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return d.toISOString().slice(0, 16);
  });
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [delayBetweenEmailsMs, setDelayBetweenEmailsMs] = useState(2000);
  const [plan, setPlan] = useState<AdaptivePlanPreview | null>(null);

  useEffect(() => {
    if (isOpen) {
      sendersApi.list().then((r) => {
        setSenders(r.senders);
        if (r.senders.length > 0 && !senderId) setSenderId(r.senders[0].id);
      }).catch(() => {});
    }
  }, [isOpen]);

  const handleFileUpload = useCallback((file: File) => {
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseCSV(content);
      setRecipients(parsed);
      setRawRecipients(parsed.join('\n'));
    };
    reader.readAsText(file);
  }, []);

  const handleManualInput = useCallback((text: string) => {
    setRawRecipients(text);
    const parsed = parseEmailsFromText(text);
    setRecipients(parsed);
  }, []);

  const handlePreview = async () => {
    if (!senderId || recipients.length === 0) return;
    setLoading(true);
    try {
      const result = await campaignsApi.preview({
        senderId,
        hourlyLimit,
        totalEmails: recipients.length,
        startTime: new Date(scheduledAt).toISOString(),
        delayBetweenEmailsMs,
      });
      setPlan(result.plan);
      setStep(4);
    } catch (e: any) {
      showToast(e.message || 'Failed to preview schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await campaignsApi.create({
        subject,
        body,
        recipients,
        senderId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        hourlyLimit,
        delayBetweenEmailsMs,
      });
      showToast(`Campaign scheduled for ${recipients.length} recipients! 🎉`, 'success');
      onSuccess?.();
      handleClose();
    } catch (e: any) {
      showToast(e.message || 'Failed to schedule campaign', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSubject('');
    setBody('');
    setRecipients([]);
    setRawRecipients('');
    setCsvFileName('');
    setPlan(null);
    onClose();
  };

  const canGoNext = () => {
    if (step === 1) return subject.trim().length > 0 && body.trim().length > 0;
    if (step === 2) return recipients.length > 0;
    if (step === 3) return senderId && scheduledAt;
    return true;
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Compose New Campaign" size="xl">
      {/* Step indicator */}
      <div className="px-6 pt-4 pb-0">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <button
                onClick={() => step > s.n && setStep(s.n as Step)}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  step === s.n ? 'text-indigo-400' : step > s.n ? 'text-emerald-400 cursor-pointer' : 'text-gray-600'
                }`}
              >
                <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold transition-all ${
                  step === s.n ? 'bg-indigo-600 text-white' : step > s.n ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-500'
                }`}>
                  {step > s.n ? '✓' : s.n}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px w-8 ${step > s.n ? 'bg-emerald-500/50' : 'bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="p-6">
        {/* Step 1: Compose */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in-up">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Subject *</label>
              <input
                id="compose-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Your email subject..."
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Body (HTML supported) *</label>
              <textarea
                id="compose-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email body here... HTML is supported."
                rows={10}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono resize-none"
              />
              <p className="text-xs text-gray-600 mt-1">{body.length} characters</p>
            </div>
          </div>
        )}

        {/* Step 2: Recipients */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in-up">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Upload CSV / Text File</label>
              <div
                className="border-2 border-dashed border-gray-700 hover:border-indigo-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  id="csv-upload"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                />
                <div className="text-3xl mb-2">📤</div>
                <p className="text-sm text-gray-300">
                  {csvFileName ? `✅ ${csvFileName}` : 'Click or drag & drop a CSV/TXT file'}
                </p>
                <p className="text-xs text-gray-600 mt-1">One email per line, or comma-separated</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-xs text-gray-500">or paste emails</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            <div>
              <textarea
                id="recipients-textarea"
                value={rawRecipients}
                onChange={(e) => handleManualInput(e.target.value)}
                placeholder="john@example.com&#10;jane@example.com&#10;..."
                rows={6}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono resize-none"
              />
            </div>

            {recipients.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-400 text-lg">✅</span>
                <div>
                  <p className="text-sm font-medium text-emerald-300">{recipients.length} email addresses detected</p>
                  <p className="text-xs text-gray-500">{recipients.slice(0, 3).join(', ')}{recipients.length > 3 ? ` +${recipients.length - 3} more` : ''}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Schedule Config */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-in-up">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">From Sender</label>
              {senders.length === 0 ? (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-yellow-400">No senders configured.</p>
                  <button
                    onClick={async () => {
                      await sendersApi.seed();
                      const r = await sendersApi.list();
                      setSenders(r.senders);
                      if (r.senders.length > 0) setSenderId(r.senders[0].id);
                    }}
                    className="text-xs text-indigo-400 hover:underline mt-1"
                  >
                    Click to auto-create 3 demo Ethereal senders
                  </button>
                </div>
              ) : (
                <select
                  id="sender-select"
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  {senders.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email}) — limit: {s.hourlyLimit}/hr</option>
                  ))}
                </select>
              )}

              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSender(!showAddSender)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  {showAddSender ? 'Cancel' : '+ Add Custom SMTP Sender (Gmail, etc.)'}
                </button>
              </div>

              {showAddSender && (
                <div className="mt-3 p-4 rounded-xl bg-gray-900/50 border border-gray-800 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">New Custom Sender Settings</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Display Name</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={newSenderName}
                        onChange={(e) => setNewSenderName(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="john@example.com"
                        value={newSenderEmail}
                        onChange={(e) => setNewSenderEmail(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[11px] text-gray-400 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        placeholder="smtp.gmail.com"
                        value={newSenderHost}
                        onChange={(e) => setNewSenderHost(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Port</label>
                      <input
                        type="number"
                        placeholder="587"
                        value={newSenderPort}
                        onChange={(e) => setNewSenderPort(Number(e.target.value))}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">SMTP Username</label>
                      <input
                        type="text"
                        placeholder="john@example.com"
                        value={newSenderUser}
                        onChange={(e) => setNewSenderUser(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">App Password</label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••"
                        value={newSenderPass}
                        onChange={(e) => setNewSenderPass(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-800/50">
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newSenderSecure}
                        onChange={(e) => setNewSenderSecure(e.target.checked)}
                        className="rounded bg-gray-950 border-gray-800 text-indigo-500 focus:ring-0 focus:ring-offset-0"
                      />
                      Use SSL/TLS (port 465)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddSender}
                      disabled={addingSender}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-1.5 rounded-lg text-xs transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {addingSender ? 'Saving...' : 'Save Sender'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Start Time</label>
              <input
                id="scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Hourly Limit</label>
                <input
                  id="hourly-limit"
                  type="number"
                  min={1}
                  max={1000}
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 100)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-xs text-gray-600 mt-1">emails per hour max</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Delay Between Emails</label>
                <input
                  id="delay-ms"
                  type="number"
                  min={1000}
                  step={1000}
                  value={delayBetweenEmailsMs}
                  onChange={(e) => setDelayBetweenEmailsMs(parseInt(e.target.value) || 2000)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-xs text-gray-600 mt-1">{delayBetweenEmailsMs / 1000}s between each send</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Adaptive Schedule Preview */}
        {step === 4 && plan && (
          <div className="space-y-5 animate-fade-in-up">
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <h3 className="text-sm font-semibold text-indigo-300 mb-3">🧠 Adaptive Schedule Plan</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Total Emails</p>
                  <p className="text-lg font-bold text-white">{plan.totalEmails}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Hours Spanned</p>
                  <p className="text-lg font-bold text-white">{plan.hoursSpanned}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">First Send</p>
                  <p className="text-sm font-semibold text-emerald-400">{formatDateTime(plan.firstSendTime)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Send</p>
                  <p className="text-sm font-semibold text-purple-400">{formatDateTime(plan.lastSendTime)}</p>
                </div>
              </div>
            </div>

            {plan.slotsRemainingCurrentHour < plan.totalEmails && (
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <p className="text-sm text-orange-400">
                  ⚠️ Only <strong>{plan.slotsRemainingCurrentHour}</strong> slots available in the current hour.{' '}
                  <strong>{plan.totalEmails - plan.slotsRemainingCurrentHour}</strong> emails will be intelligently rescheduled to the next available window.
                </p>
              </div>
            )}

            {/* Timeline preview */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Estimated Send Timeline</h4>
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {plan.estimatedTimes.slice(0, 20).map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600 tabular-nums w-6 text-right">#{i + 1}</span>
                    <span className="text-xs text-gray-400 tabular-nums">{formatDateTime(t)}</span>
                    <div className="flex-1 h-px bg-gray-800" />
                    {i < plan.slotsRemainingCurrentHour ? (
                      <span className="text-xs text-emerald-500">Current Hour</span>
                    ) : (
                      <span className="text-xs text-purple-400">Next Window</span>
                    )}
                  </div>
                ))}
                {plan.totalEmails > 20 && (
                  <p className="text-xs text-gray-600 text-center py-2">
                    + {plan.totalEmails - 20} more emails...
                  </p>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 space-y-2 text-sm">
              <p className="text-gray-400"><span className="text-gray-200">Subject:</span> {subject}</p>
              <p className="text-gray-400"><span className="text-gray-200">Recipients:</span> {recipients.length} emails</p>
              <p className="text-gray-400"><span className="text-gray-200">Hourly Limit:</span> {hourlyLimit}/hr</p>
              <p className="text-gray-400"><span className="text-gray-200">Delay:</span> {delayBetweenEmailsMs / 1000}s between emails</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-6 border-t border-gray-800/50 shrink-0">
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as Step)}>
              ← Back
            </Button>
          )}
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
        </div>
        <div>
          {step < 3 && (
            <Button
              variant="primary"
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={!canGoNext()}
            >
              Continue →
            </Button>
          )}
          {step === 3 && (
            <Button
              variant="primary"
              onClick={handlePreview}
              loading={loading}
              disabled={!canGoNext() || !senderId}
            >
              Preview Schedule
            </Button>
          )}
          {step === 4 && (
            <Button
              variant="gradient"
              onClick={handleSubmit}
              loading={submitting}
            >
              🚀 Schedule Campaign
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
