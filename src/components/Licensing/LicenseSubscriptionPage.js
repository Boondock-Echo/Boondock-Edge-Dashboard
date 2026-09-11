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
import Button from "../ui/Button";
import cardStyles from "../ui/Card.module.css";
import formStyles from "../ui/Form.module.css";
import pageStyles from "../ui/Page.module.css";
import shellStyles from "../ui/CommandCenterShell.module.css";

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

function StatusPill({ children, tone = "neutral" }) {
  const tones = {
    neutral: "",
    positive: "pillSuccess",
    caution: "pillWarning",
    critical: "pillDanger",
  };
  return (
    <span className={`pill ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  );
}

function ThinProgress({ used, total, ariaLabel }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 1000) / 10) : 0;
  return (
    <div className="meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={ariaLabel}>
      <div className="meterFill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Panel({ id, eyebrow, title, subtitle, children }) {
  return (
    <section id={id} className={cardStyles.card}>
      <div className="stack stackCompact">
        {eyebrow ? <p className="pill">{eyebrow}</p> : null}
        <h2 className={cardStyles.title}>{title}</h2>
        {subtitle ? <p className={cardStyles.description}>{subtitle}</p> : null}
      </div>
      <div className="divider" />
      {children}
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

export default function LicenseSubscriptionPage() {
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
    <div className="stack grow">
      <div>
        <p className={shellStyles.sidebarLabel}>
          Sections
        </p>
      </div>
      <nav className={shellStyles.sidebarNav}>
        {SIDEBAR_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => scrollTo(item.id)}
            className={shellStyles.sidebarNavItem}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <SidebarFooter />
    </div>
  );

  const bindingTone =
    data.hardwareBinding === "verified" ? "positive" : data.hardwareBinding === "mismatch" ? "caution" : "neutral";
  const licenseTone = data.licenseStatus === "active" ? "positive" : "critical";

  return (
    <CommandCenterShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      areaTitle="Operations"
      areaSubtitle="License & subscription"
      productName="Back to Dashboard"
      showBackToDashboardButton
      showHeaderSearch={false}
      sidebar={sidebar}
    >
      <div className="stack stackLarge">
        <header className="stack stackCompact">
          <h1 className={pageStyles.title}>
            License & subscription
          </h1>
          <p className={pageStyles.subtitle}>
            Binding, entitlement, and usage for this edge device. Values shown are representative until connected to your billing backend.
          </p>
        </header>

        <div className="gridTwo">
          <div className="stack stackLarge">
            <Panel
              id="license-overview"
              eyebrow="Identity"
              title="License overview"
              subtitle="Key display is masked; copy reveals the full key for support workflows."
            >
              <dl className="gridTwo">
                <div>
                  <dt className={cardStyles.title}>
                    <KeyRound aria-hidden />
                    License key
                  </dt>
                  <dd className="rowWrap">
                    <code
                      className="pill"
                    >
                      {data.licenseKeyMasked}
                    </code>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={copyKey}
                    >
                      {copied ? <Check /> : <Copy />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </dd>
                </div>
                <div>
                  <dt className={cardStyles.title}>
                    Device name
                  </dt>
                  <dd className={cardStyles.description}>{data.deviceName}</dd>
                </div>
                <div>
                  <dt className={cardStyles.title}>
                    Device ID
                  </dt>
                  <dd className={cardStyles.description}>{data.deviceId}</dd>
                </div>
                <div>
                  <dt className={cardStyles.title}>
                    <Link2 aria-hidden />
                    Hardware binding
                  </dt>
                  <dd className="rowWrap">
                    <span className={cardStyles.description}>
                      <Circle
                        className={cardStyles.description}
                        aria-hidden
                      />
                      {data.hardwareBinding === "verified" ? "Verified" : "Mismatch"}
                    </span>
                    <StatusPill tone={bindingTone}>
                      {data.hardwareBinding === "verified" ? "Bound" : "Review"}
                    </StatusPill>
                  </dd>
                </div>
                <div>
                  <dt className={cardStyles.title}>
                    License status
                  </dt>
                  <dd>
                    <StatusPill tone={licenseTone}>
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
            >
              {data.plan === "connect" ? (
                <div className="rowBetweenStart">
                  <div>
                    <p className={cardStyles.description}>
                      Connect plan
                      <span className={cardStyles.title}>$50/mo</span>
                    </p>
                    <p className={cardStyles.description}>
                      Renewal date{" "}
                      <time dateTime={data.renewalDate}>
                        {data.renewalDate}
                      </time>
                    </p>
                  </div>
                  <div className="rowWrap">
                    <Button variant="secondary" size="small">
                      Upgrade
                    </Button>
                    <Button variant="secondary" size="small">
                      Downgrade
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rowBetween">
                  <div>
                    <p className={cardStyles.description}>Base plan (Free)</p>
                    <p className={cardStyles.description}>Local limits apply; cloud features optional.</p>
                  </div>
                  <Button variant="primary">
                    Upgrade to Connect
                  </Button>
                </div>
              )}
            </Panel>

            <Panel
              id="usage-credits"
              eyebrow="Consumption"
              title="Usage & credits"
              subtitle="Monthly allowance and storage for this device."
            >
              <div className="stack stackLarge">
                <div>
                  <div className="rowBetween">
                    <span className={cardStyles.title}>
                      Monthly transcription credits
                    </span>
                    <span className={formStyles.helpText}>
                      {data.monthlyCreditsUsed.toLocaleString()} / {data.monthlyCreditsTotal.toLocaleString()} used
                    </span>
                  </div>
                  <ThinProgress
                    used={data.monthlyCreditsUsed}
                    total={data.monthlyCreditsTotal}
                    ariaLabel="Monthly transcription credits used"
                  />
                  <p className={cardStyles.description}>
                    <span className={cardStyles.title}>Remaining:</span>{" "}
                    <span>{creditsRemaining.toLocaleString()}</span> credits
                  </p>
                </div>

                <div className={cardStyles.compact}>
                  <div>
                    <p className={cardStyles.title}>On-demand usage</p>
                    <p className={formStyles.helpText}>
                      When enabled, transcription continues against your account after monthly credits are exhausted (metered). When off, processing falls back to local rules once credits reach zero.
                    </p>
                  </div>
                  <label className={formStyles.switch}>
                    <input
                      type="checkbox"
                      checked={onDemandEnabled}
                      onChange={(e) => setOnDemandEnabled(e.target.checked)}
                      aria-label="On-demand usage"
                    />
                    <span className={formStyles.switchTrack} aria-hidden="true">
                      <span className={formStyles.switchThumb} />
                    </span>
                  </label>
                  <span className={formStyles.helpText}>
                    {onDemandEnabled ? "On" : "Off"}
                  </span>
                </div>

                <div>
                  <div className="rowBetween">
                    <span className={cardStyles.title}>
                      <Cpu aria-hidden />
                      Cloud storage
                    </span>
                    <span className={formStyles.helpText}>
                      {data.cloudStorageGbUsed.toFixed(1)} GB / {data.cloudStorageGbTotal} GB
                    </span>
                  </div>
                  <ThinProgress
                    used={data.cloudStorageGbUsed}
                    total={data.cloudStorageGbTotal}
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
            >
              <div className={cardStyles.compact}>
                <div className="rowWrap">
                  <div
                    className="pill"
                  >
                    <ProcessingIcon className={cardStyles.description} aria-hidden />
                  </div>
                  <div className="grow">
                    <p className={cardStyles.title}>
                      {data.processingMode === "cloud" ? "Cloud processing" : "Local processing"}{" "}
                      <span className={cardStyles.description}>
                        ({processing.state === "active" ? "active" : "fallback"})
                      </span>
                    </p>
                    <p className={cardStyles.description}>
                      {processing.detail}
                    </p>
                    {data.processingMode === "local" && data.processingReason ? (
                      <p className={formStyles.helpText}>
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
            >
              <div className="rowWrap">
                <Button variant="primary">
                  {data.plan === "connect" ? "Manage subscription" : "Upgrade to Connect plan"}
                  <ChevronRight />
                </Button>
                <Button variant="secondary">
                  <CreditCard />
                  Buy additional credits
                </Button>
              </div>
            </Panel>
          </div>

          <aside className="stack">
            <Panel id="activity-summary" eyebrow="Today" title="Activity summary" subtitle="Lightweight operational snapshot.">
              <ul className="stack">
                <li className="rowBetweenStart">
                  <span className={cardStyles.description}>
                    <Activity aria-hidden />
                    Transcriptions
                  </span>
                  <span className={cardStyles.title}>
                    {data.transcriptionsToday}
                  </span>
                </li>
                <li className="rowBetweenStart">
                  <span className={cardStyles.description}>
                    <Gauge aria-hidden />
                    Credits consumed
                  </span>
                  <span className={cardStyles.title}>
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
