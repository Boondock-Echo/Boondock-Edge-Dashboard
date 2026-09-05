import React, { useCallback, useMemo, useState } from "react";
import CommandCenterShell from "../layout/CommandCenterShell";
import SidebarFooter from "../Dashboard/SidebarFooter";
import {
  Copy,
  Check,
  KeyRound,
  Cpu,
  Link2,
  Circle,
  Cloud,
  HardDrive,
  Gauge,
  CreditCard,
  Activity,
  ChevronRight,
} from "lucide-react";

/**
 * Demo / placeholder values — replace with API integration.
 * Shape documents expected fields for future wiring.
 *
 * Local fallback preview (UI): set processingMode to "local" and e.g.
 * processingReason: "Credits exhausted" or "Cloud unreachable".
 */
const DEMO_LICENSE = {
  licenseKeyMasked: "BDK•••••••••••••••••••F4A2",
  licenseKeyFull: "BDK-EDGE-9X7K-4M2P-Q8VN-F4A2",
  deviceName: "Edge Recorder — Bayfield COMMS-01",
  deviceId: "hw-bdke-8f3c91e2a440",
  hardwareBinding: "verified",
  licenseStatus: "active",
  plan: "connect",
  renewalDate: "2026-06-14",
  monthlyCreditsTotal: 5000,
  monthlyCreditsUsed: 3200,
  cloudStorageGbTotal: 10,
  cloudStorageGbUsed: 6.2,
  onDemandDefault: false,
  processingMode: "cloud",
  processingReason: null,
  transcriptionsToday: 142,
  creditsConsumedToday: 218,
};

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

function StatusPill({ children, tone = "neutral", isDarkMode }) {
  const tones = {
    neutral: isDarkMode
      ? "border-slate-600/80 bg-slate-800/80 text-slate-300"
      : "border-slate-300/90 bg-slate-50 text-slate-700",
    positive: isDarkMode
      ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-300/95"
      : "border-emerald-200 bg-emerald-50/90 text-emerald-900",
    caution: isDarkMode
      ? "border-amber-900/50 bg-amber-950/35 text-amber-200/90"
      : "border-amber-200 bg-amber-50 text-amber-900",
    critical: isDarkMode
      ? "border-red-900/50 bg-red-950/40 text-red-300"
      : "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tones[tone] || tones.neutral
      )}
    >
      {children}
    </span>
  );
}

function ThinProgress({ used, total, isDarkMode, ariaLabel }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 1000) / 10) : 0;
  return (
    <div className="w-full" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={ariaLabel}>
      <div
        className={cn(
          "h-1.5 w-full overflow-hidden rounded-full",
          isDarkMode ? "bg-slate-800" : "bg-slate-200"
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            isDarkMode ? "bg-slate-500" : "bg-slate-600"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Panel({ id, eyebrow, title, subtitle, children, isDarkMode }) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-xl border shadow-sm",
        isDarkMode ? "border-slate-800 bg-slate-900/60" : "border-slate-200/90 bg-white"
      )}
    >
      <div className={cn("border-b px-5 py-4", isDarkMode ? "border-slate-800" : "border-slate-100")}>
        {eyebrow ? (
          <p className={cn("mb-1 text-[11px] font-semibold uppercase tracking-wider", isDarkMode ? "text-slate-500" : "text-slate-500")}>
            {eyebrow}
          </p>
        ) : null}
        <h2 className={cn("font-headline text-base font-bold tracking-tight", isDarkMode ? "text-slate-100" : "text-slate-900")}>
          {title}
        </h2>
        {subtitle ? (
          <p className={cn("mt-1 text-sm", isDarkMode ? "text-slate-400" : "text-slate-600")}>{subtitle}</p>
        ) : null}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

const SIDEBAR_NAV = [
  { id: "license-overview", label: "License overview", icon: "badge" },
  { id: "subscription-plan", label: "Subscription", icon: "subscriptions" },
  { id: "usage-credits", label: "Usage & credits", icon: "data_usage" },
  { id: "system-behavior", label: "Processing mode", icon: "swap_horiz" },
  { id: "billing-cta", label: "Plan actions", icon: "payments" },
  { id: "activity-summary", label: "Activity", icon: "monitoring" },
];

export default function LicenseSubscriptionPage({ isDarkMode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [onDemandEnabled, setOnDemandEnabled] = useState(DEMO_LICENSE.onDemandDefault);

  const data = DEMO_LICENSE;

  const creditsRemaining = Math.max(0, data.monthlyCreditsTotal - data.monthlyCreditsUsed);
  const storagePct = data.cloudStorageGbTotal > 0 ? (data.cloudStorageGbUsed / data.cloudStorageGbTotal) * 100 : 0;

  const processing = useMemo(() => {
    if (data.processingMode === "cloud") {
      return {
        label: "Cloud processing",
        state: "active",
        detail: "Transcription routed through cloud services.",
        Icon: Cloud,
      };
    }
    return {
      label: "Local processing",
      state: "fallback",
      detail: data.processingReason || "Operating on-device.",
      Icon: HardDrive,
    };
  }, [data.processingMode, data.processingReason]);

  const ProcessingIcon = processing.Icon;

  const copyKey = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.licenseKeyFull);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [data.licenseKeyFull]);

  const scrollTo = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setSidebarOpen(false);
  };

  const sidebar = (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="px-4 pb-2 pt-4">
        <p className={cn("text-[11px] font-semibold uppercase tracking-wider", isDarkMode ? "text-slate-500" : "text-slate-500")}>
          Sections
        </p>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {SIDEBAR_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollTo(item.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
              isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-200/70"
            )}
          >
            <span className="material-symbols-outlined text-[20px] text-slate-500">{item.icon}</span>
            <span className="leading-snug">{item.label}</span>
          </button>
        ))}
      </nav>
      <SidebarFooter isDarkMode={isDarkMode} />
    </div>
  );

  const bindingTone =
    data.hardwareBinding === "verified" ? "positive" : data.hardwareBinding === "mismatch" ? "caution" : "neutral";
  const licenseTone = data.licenseStatus === "active" ? "positive" : "critical";

  return (
    <CommandCenterShell
      isDarkMode={isDarkMode}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      areaTitle="Operations"
      areaSubtitle="License & subscription"
      productName="Back to Dashboard"
      showBackToDashboardButton
      showHeaderSearch={false}
      sidebar={sidebar}
    >
      <div className="mx-auto max-w-6xl space-y-6 pb-16">
        <header className="space-y-1">
          <h1 className={cn("font-headline text-2xl font-extrabold tracking-tight md:text-3xl", isDarkMode ? "text-slate-100" : "text-slate-900")}>
            License & subscription
          </h1>
          <p className={cn("max-w-2xl text-sm leading-relaxed", isDarkMode ? "text-slate-400" : "text-slate-600")}>
            Binding, entitlement, and usage for this edge device. Values shown are representative until connected to your billing backend.
          </p>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            <Panel
              id="license-overview"
              eyebrow="Identity"
              title="License overview"
              subtitle="Key display is masked; copy reveals the full key for support workflows."
              isDarkMode={isDarkMode}
            >
              <dl className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className={cn("mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                    <KeyRound className="h-3.5 w-3.5 opacity-80" aria-hidden />
                    License key
                  </dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <code
                      className={cn(
                        "rounded-md px-3 py-2 font-mono text-sm tracking-tight",
                        isDarkMode ? "bg-slate-950 text-slate-200 ring-1 ring-slate-800" : "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80"
                      )}
                    >
                      {data.licenseKeyMasked}
                    </code>
                    <button
                      type="button"
                      onClick={copyKey}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                        isDarkMode
                          ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                          : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                      )}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </dd>
                </div>
                <div>
                  <dt className={cn("mb-1 text-[11px] font-semibold uppercase tracking-wider", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                    Device name
                  </dt>
                  <dd className={cn("text-sm font-medium", isDarkMode ? "text-slate-200" : "text-slate-900")}>{data.deviceName}</dd>
                </div>
                <div>
                  <dt className={cn("mb-1 text-[11px] font-semibold uppercase tracking-wider", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                    Device ID
                  </dt>
                  <dd className={cn("font-mono text-sm", isDarkMode ? "text-slate-300" : "text-slate-700")}>{data.deviceId}</dd>
                </div>
                <div>
                  <dt className={cn("mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                    <Link2 className="h-3.5 w-3.5 opacity-80" aria-hidden />
                    Hardware binding
                  </dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", isDarkMode ? "text-slate-200" : "text-slate-800")}>
                      <Circle
                        className={cn(
                          "h-2 w-2 shrink-0 fill-current",
                          data.hardwareBinding === "verified"
                            ? isDarkMode
                              ? "text-emerald-500/90"
                              : "text-emerald-600"
                            : isDarkMode
                              ? "text-amber-400"
                              : "text-amber-600"
                        )}
                        aria-hidden
                      />
                      {data.hardwareBinding === "verified" ? "Verified" : "Mismatch"}
                    </span>
                    <StatusPill tone={bindingTone} isDarkMode={isDarkMode}>
                      {data.hardwareBinding === "verified" ? "Bound" : "Review"}
                    </StatusPill>
                  </dd>
                </div>
                <div>
                  <dt className={cn("mb-2 text-[11px] font-semibold uppercase tracking-wider", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                    License status
                  </dt>
                  <dd>
                    <StatusPill tone={licenseTone} isDarkMode={isDarkMode}>
                      {data.licenseStatus === "active" ? "Active" : "Inactive"}
                    </StatusPill>
                  </dd>
                </div>
              </dl>
            </Panel>

            <Panel
              id="subscription-plan"
              eyebrow="Entitlement"
              title="Subscription plan"
              subtitle="Current commercial tier for cloud transcription and related services."
              isDarkMode={isDarkMode}
            >
              {data.plan === "connect" ? (
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className={cn("text-lg font-bold tracking-tight", isDarkMode ? "text-slate-100" : "text-slate-900")}>
                      Connect plan
                      <span className={cn("ml-2 text-base font-semibold", isDarkMode ? "text-slate-400" : "text-slate-600")}>$50/mo</span>
                    </p>
                    <p className={cn("mt-1 text-sm", isDarkMode ? "text-slate-400" : "text-slate-600")}>
                      Renewal date{" "}
                      <time dateTime={data.renewalDate} className="font-mono tabular-nums">
                        {data.renewalDate}
                      </time>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={cn(
                        "rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
                        isDarkMode
                          ? "border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
                          : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                      )}
                    >
                      Upgrade
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
                        isDarkMode
                          ? "border border-slate-600 bg-transparent text-slate-300 hover:bg-slate-800"
                          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      Downgrade
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className={cn("text-lg font-bold", isDarkMode ? "text-slate-100" : "text-slate-900")}>Base plan (Free)</p>
                    <p className={cn("mt-1 text-sm", isDarkMode ? "text-slate-400" : "text-slate-600")}>Local limits apply; cloud features optional.</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg bg-[#f36d22] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#e0621c]"
                  >
                    Upgrade to Connect
                  </button>
                </div>
              )}
            </Panel>

            <Panel
              id="usage-credits"
              eyebrow="Consumption"
              title="Usage & credits"
              subtitle="Monthly allowance and storage for this device."
              isDarkMode={isDarkMode}
            >
              <div className="space-y-6">
                <div>
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <span className={cn("text-sm font-semibold", isDarkMode ? "text-slate-200" : "text-slate-800")}>
                      Monthly transcription credits
                    </span>
                    <span className={cn("font-mono text-xs tabular-nums", isDarkMode ? "text-slate-400" : "text-slate-600")}>
                      {data.monthlyCreditsUsed.toLocaleString()} / {data.monthlyCreditsTotal.toLocaleString()} used
                    </span>
                  </div>
                  <ThinProgress
                    used={data.monthlyCreditsUsed}
                    total={data.monthlyCreditsTotal}
                    isDarkMode={isDarkMode}
                    ariaLabel="Monthly transcription credits used"
                  />
                  <p className={cn("mt-2 text-sm", isDarkMode ? "text-slate-400" : "text-slate-600")}>
                    <span className={cn("font-semibold", isDarkMode ? "text-slate-200" : "text-slate-800")}>Remaining:</span>{" "}
                    <span className="font-mono tabular-nums">{creditsRemaining.toLocaleString()}</span> credits
                  </p>
                </div>

                <div className={cn("flex flex-col gap-3 rounded-lg border px-4 py-4 sm:flex-row sm:items-center sm:justify-between", isDarkMode ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50/80")}>
                  <div>
                    <p className={cn("text-sm font-semibold", isDarkMode ? "text-slate-200" : "text-slate-800")}>On-demand usage</p>
                    <p className={cn("mt-1 max-w-xl text-xs leading-relaxed", isDarkMode ? "text-slate-500" : "text-slate-600")}>
                      When enabled, transcription continues against your account after monthly credits are exhausted (metered). When off, processing falls back to local rules once credits reach zero.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={onDemandEnabled}
                    onClick={() => setOnDemandEnabled((v) => !v)}
                    className={cn(
                      "relative h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                      onDemandEnabled
                        ? "bg-slate-500 focus-visible:ring-slate-400"
                        : isDarkMode
                          ? "bg-slate-700 focus-visible:ring-slate-500"
                          : "bg-slate-300 focus-visible:ring-slate-400",
                      isDarkMode ? "focus-visible:ring-offset-slate-900" : "focus-visible:ring-offset-white"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform",
                        onDemandEnabled ? "translate-x-6" : "translate-x-0"
                      )}
                    />
                  </button>
                  <span className={cn("text-xs font-semibold uppercase tracking-wide sm:hidden", isDarkMode ? "text-slate-500" : "text-slate-600")}>
                    {onDemandEnabled ? "On" : "Off"}
                  </span>
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <span className={cn("flex items-center gap-2 text-sm font-semibold", isDarkMode ? "text-slate-200" : "text-slate-800")}>
                      <Cpu className="h-4 w-4 opacity-80" aria-hidden />
                      Cloud storage
                    </span>
                    <span className={cn("font-mono text-xs tabular-nums", isDarkMode ? "text-slate-400" : "text-slate-600")}>
                      {data.cloudStorageGbUsed.toFixed(1)} GB / {data.cloudStorageGbTotal} GB
                    </span>
                  </div>
                  <ThinProgress
                    used={data.cloudStorageGbUsed}
                    total={data.cloudStorageGbTotal}
                    isDarkMode={isDarkMode}
                    ariaLabel="Cloud storage used"
                  />
                </div>
              </div>
            </Panel>

            <Panel
              id="system-behavior"
              eyebrow="Runtime"
              title="System behavior"
              subtitle="Where transcription work executes for this site."
              isDarkMode={isDarkMode}
            >
              <div className={cn("rounded-lg border px-4 py-4", isDarkMode ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-slate-50/90")}>
                <div className="flex flex-wrap items-start gap-4">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border",
                      isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
                    )}
                  >
                    <ProcessingIcon className={cn("h-5 w-5", isDarkMode ? "text-slate-300" : "text-slate-700")} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-semibold", isDarkMode ? "text-slate-100" : "text-slate-900")}>
                      {data.processingMode === "cloud" ? "Cloud processing" : "Local processing"}{" "}
                      <span className={cn("font-normal", isDarkMode ? "text-slate-500" : "text-slate-500")}>
                        ({processing.state === "active" ? "active" : "fallback"})
                      </span>
                    </p>
                    <p className={cn("mt-1 text-sm leading-relaxed", isDarkMode ? "text-slate-400" : "text-slate-600")}>
                      {processing.detail}
                    </p>
                    {data.processingMode === "local" && data.processingReason ? (
                      <p className={cn("mt-2 border-t pt-2 text-xs font-medium", isDarkMode ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-600")}>
                        Reason: {data.processingReason}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              id="billing-cta"
              eyebrow="Billing"
              title="Upgrade & billing"
              subtitle="Primary actions for plan changes and add-on purchases."
              isDarkMode={isDarkMode}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#f36d22] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#e0621c]"
                >
                  {data.plan === "connect" ? "Manage subscription" : "Upgrade to Connect plan"}
                  <ChevronRight className="h-4 w-4 opacity-90" />
                </button>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors",
                    isDarkMode
                      ? "border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-750"
                      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <CreditCard className="h-4 w-4" />
                  Buy additional credits
                </button>
              </div>
            </Panel>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <Panel id="activity-summary" eyebrow="Today" title="Activity summary" subtitle="Lightweight operational snapshot." isDarkMode={isDarkMode}>
              <ul className="space-y-4">
                <li className="flex items-start justify-between gap-3">
                  <span className={cn("flex items-center gap-2 text-sm", isDarkMode ? "text-slate-400" : "text-slate-600")}>
                    <Activity className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    Transcriptions
                  </span>
                  <span className={cn("font-mono text-sm font-semibold tabular-nums", isDarkMode ? "text-slate-100" : "text-slate-900")}>
                    {data.transcriptionsToday}
                  </span>
                </li>
                <li className="flex items-start justify-between gap-3">
                  <span className={cn("flex items-center gap-2 text-sm", isDarkMode ? "text-slate-400" : "text-slate-600")}>
                    <Gauge className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    Credits consumed
                  </span>
                  <span className={cn("font-mono text-sm font-semibold tabular-nums", isDarkMode ? "text-slate-100" : "text-slate-900")}>
                    {data.creditsConsumedToday}
                  </span>
                </li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    </CommandCenterShell>
  );
}
