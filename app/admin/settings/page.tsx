"use client";

import { useState, useEffect } from "react";
import { getDiscordSettings, saveDiscordSettings, testDiscordConnection } from "@/lib/actions";
import { 
  Settings, 
  Link2, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Sliders, 
  HelpCircle, 
  Save, 
  Send, 
  Info,
  ChevronRight,
  RotateCcw
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const DEFAULT_TEMPLATE = `📋 **Daily Status {actionLabel} by {userName}** ({userRole})

📅 **Date**: {date}

📂 **Projects & Hours**:
{projectHoursList}

✅ **Work Done**:
{workDone}

🎯 **Next Planned Work**:
{plannedWork}

🚧 **Blockers**:
{blockers}

🕒 **{actionLabel} At**: {timeFormatted}`;

export default function AdminSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Settings state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [messageFormat, setMessageFormat] = useState("");

  // Loading & feedback states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string } | null>(null);

  // Active sub-section
  const [activeTab, setActiveTab] = useState("integrations");
  const [activeIntegration, setActiveIntegration] = useState("discord");

  useEffect(() => {
    // Redirect if not ADMIN (after session finishes loading)
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && (session?.user as any)?.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  useEffect(() => {
    async function loadSettings() {
      if (status !== "authenticated" || (session?.user as any)?.role !== "ADMIN") return;
      try {
        const res = await getDiscordSettings();
        if (res && 'error' in res) {
          setError(res.error || "Failed to load Discord settings.");
        } else if (res) {
          setWebhookUrl(res.webhookUrl || "");
          setEnabled(res.enabled || false);
          setMessageFormat((res as any).messageFormat || "");
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [session, status]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setError("");

    try {
      const res = await saveDiscordSettings(webhookUrl, enabled, messageFormat);
      if (res && 'error' in res) {
        setError(res.error || "Failed to save settings.");
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!webhookUrl) {
      setError("Please enter a webhook URL first before testing.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    setError("");

    try {
      const res = await testDiscordConnection(webhookUrl);
      if (res && 'error' in res) {
        setTestResult({ error: res.error });
      } else {
        setTestResult({ success: true });
      }
    } catch (err: any) {
      setTestResult({ error: err.message || "Test connection failed." });
    } finally {
      setTesting(false);
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = document.getElementById("messageFormatTextarea") as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    
    const newValue = before + placeholder + after;
    setMessageFormat(newValue);
    
    // Reset cursor position after state updates
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  const renderPreview = (text: string) => {
    const templateToRender = text || DEFAULT_TEMPLATE;
    
    const mockData = {
      userName: "John Doe",
      userRole: "QA ENGINEER",
      actionLabel: "Submitted",
      date: "2026-06-13",
      projectHoursList: "• Project Alpha: 5.5 hrs\n• Project Beta: 2.5 hrs",
      workDone: "1. Created smoke test cases for release v2.3.\n2. Executed integration tests on staging environment.",
      plannedWork: "1. Run regression suite tomorrow.\n2. Review developer PRs.",
      blockers: "None",
      timeFormatted: "6/13/2026, 7:17:19 PM",
    };
    
    let rendered = templateToRender;
    for (const [key, val] of Object.entries(mockData)) {
      rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    }
    
    return rendered.split('\n').map((line, idx) => {
      let parts = [];
      const boldRegex = /\*\*(.*?)\*\*/g;
      let match;
      let lastIndex = 0;
      
      while ((match = boldRegex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="font-bold text-white">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }
      
      return (
        <div key={idx} className="min-h-[1.5rem] break-words">
          {parts.length > 0 ? parts : line}
        </div>
      );
    });
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-[#ed5c37] animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse text-sm">Loading settings panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="page-header !mb-0">
        <h1 className="page-title">Settings Center</h1>
        <p className="page-desc">Manage global platform configurations, integrations, and webhooks</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: settings sub-menu */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-3 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2 block">Settings</span>
            
            <button 
              onClick={() => {}} 
              disabled 
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-400 text-sm font-semibold cursor-not-allowed text-left hover:bg-slate-50/50"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4" /> General
              </span>
              <span className="text-[9px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">Planned</span>
            </button>

            <button 
              onClick={() => setActiveTab("integrations")} 
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left cursor-pointer ${
                activeTab === "integrations" 
                  ? "bg-[#ed5c37]/5 text-[#ed5c37]" 
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2">
                <Link2 className="w-4 h-4" /> Integrations
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {activeTab === "integrations" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-3 space-y-1 animate-in slide-in-from-top-2 duration-300">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2 block">Channels</span>
              
              <button 
                onClick={() => setActiveIntegration("discord")} 
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeIntegration === "discord" 
                    ? "bg-slate-900 text-white shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>Discord Webhook</span>
                {enabled ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Active configuration form */}
        <div className="lg:col-span-3 space-y-6">
          {activeTab === "integrations" && activeIntegration === "discord" && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-700 font-black shadow-inner">
                    💬
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Discord Integration</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">Configure automated notifications for Daily Status submissions</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-8">
                <div className="space-y-6">
                  {/* Toggle integration switch */}
                  <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-1 pr-6">
                      <span className="text-sm font-bold text-slate-800 block">Enable Discord Notifications</span>
                      <p className="text-xs text-slate-500 font-medium">Toggle whether daily statuses are automatically posted to Discord</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={enabled} 
                        onChange={(e) => setEnabled(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ed5c37]"></div>
                    </label>
                  </div>

                  {/* Webhook URL Field */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-bold text-slate-700 ml-1">Discord Webhook URL</label>
                      <a 
                        href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs font-bold text-[#ed5c37] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" /> How to get a Webhook URL?
                      </a>
                    </div>
                    <div className="relative group">
                      <input 
                        type="url" 
                        required={enabled}
                        placeholder="https://discord.com/api/webhooks/..." 
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/20 rounded-xl font-bold text-sm text-slate-700 outline-none transition-all shadow-sm" 
                      />
                    </div>
                  </div>

                  {/* Message Format Field */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="block text-sm font-bold text-slate-700 ml-1">Discord Notification Format</label>
                        <p className="text-xs text-slate-400 font-semibold ml-1">Customize the structure and fields posted to Discord</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMessageFormat(DEFAULT_TEMPLATE)}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Reset to default template format"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
                      </button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                      {/* Editor Column */}
                      <div className="xl:col-span-3 space-y-4">
                        <div className="relative group">
                          <textarea
                            id="messageFormatTextarea"
                            placeholder={DEFAULT_TEMPLATE}
                            value={messageFormat}
                            onChange={(e) => setMessageFormat(e.target.value)}
                            rows={12}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-[#ed5c37]/5 focus:border-[#ed5c37]/20 rounded-xl font-mono text-xs text-slate-700 outline-none transition-all shadow-sm resize-y leading-relaxed"
                          />
                        </div>

                        {/* Placeholders helper */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Insert Dynamic Placeholders</span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: "User Name", code: "{userName}" },
                              { label: "User Role", code: "{userRole}" },
                              { label: "Action Status", code: "{actionLabel}" },
                              { label: "Date", code: "{date}" },
                              { label: "Projects & Hours", code: "{projectHoursList}" },
                              { label: "Work Done", code: "{workDone}" },
                              { label: "Planned Work", code: "{plannedWork}" },
                              { label: "Blockers", code: "{blockers}" },
                              { label: "Timestamp", code: "{timeFormatted}" },
                            ].map((ph) => (
                              <button
                                key={ph.code}
                                type="button"
                                onClick={() => insertPlaceholder(ph.code)}
                                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-lg text-[10px] font-bold text-slate-600 transition-all cursor-pointer flex items-center"
                              >
                                {ph.code}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Discord Live Preview Column */}
                      <div className="xl:col-span-2 flex flex-col space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Live Discord Chat Preview</span>
                        <div className="flex-1 min-h-[300px] bg-[#313338] text-[#dbdee1] rounded-2xl p-4 shadow-inner border border-slate-800 font-sans text-sm flex gap-3 select-none leading-normal">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-[#ed5c37]/10 flex items-center justify-center text-lg shadow-inner shrink-0 mt-0.5 border border-[#ed5c37]/25">
                            🤖
                          </div>
                          {/* Chat body */}
                          <div className="space-y-1.5 overflow-hidden w-full">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-white text-sm hover:underline cursor-pointer">CB QOps Bot</span>
                              <span className="bg-[#5865f2] text-[9px] font-bold text-white px-1.5 py-0.5 rounded uppercase tracking-wider scale-90">Bot</span>
                              <span className="text-xs text-[#949ba4] font-medium ml-1">Today at 7:17 PM</span>
                            </div>
                            {/* Message text rendering */}
                            <div className="text-sm font-medium space-y-0.5 leading-relaxed text-[#dbdee1]">
                              {renderPreview(messageFormat)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Validation and saving feedback */}
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-shake">
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <span className="text-xs font-bold text-red-700">{error}</span>
                  </div>
                )}

                {saveSuccess && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 animate-in fade-in duration-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-xs font-bold text-emerald-700">Discord integration settings saved successfully!</span>
                  </div>
                )}

                {/* Test Connection Result Panel */}
                {testResult && (
                  <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in duration-300 ${
                    testResult.success 
                      ? 'bg-emerald-50 border-emerald-100' 
                      : 'bg-red-50 border-red-100'
                  }`}>
                    {testResult.success ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-emerald-800">Connection Successful!</h4>
                          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">A test status notification has been dispatched to your Discord channel.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-red-800">Connection Failed</h4>
                          <p className="text-[10px] text-red-600 font-semibold mt-0.5">{testResult.error || "Could not reach Discord API. Please verify the URL."}</p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Future Ready Notice */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex gap-3 text-slate-500">
                  <Info className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Roadmap & Future Extensions</span>
                    <p className="text-[10px] leading-relaxed font-semibold">
                      This integration is built future-ready. Upcoming updates will support project-specific webhooks, team-specific channels, @Role mentions for blockers, and weekly summaries.
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
                  <button 
                    type="button"
                    disabled={testing || !webhookUrl}
                    onClick={handleTest}
                    className="px-5 py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#ed5c37]" /> Testing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-[#ed5c37]" /> Test Connection
                      </>
                    )}
                  </button>

                  <button 
                    type="submit"
                    disabled={saving}
                    className="btn-primary py-3 px-6 text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving Settings...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> Save Configuration
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
