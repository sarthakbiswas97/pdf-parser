import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  getSettings,
  saveSettings,
  getGoogleStatus,
  openGoogleAuth,
  disconnectGoogle,
  listSheets,
  listDriveFolders,
  testWebhook,
} from "../lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: Props) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookOn, setWebhookOn] = useState(false);
  const [sheetsId, setSheetsId] = useState("");
  const [sheetsOn, setSheetsOn] = useState(false);
  const [driveFolder, setDriveFolder] = useState("");
  const [driveOn, setDriveOn] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [sheets, setSheets] = useState<{ id: string; name: string }[]>([]);
  const [driveFolders, setDriveFolders] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState("");
  const [webhookStatus, setWebhookStatus] = useState("");

  const loadData = useCallback(async () => {
    const [s, g] = await Promise.all([getSettings(), getGoogleStatus()]);
    setWebhookUrl((s.webhook_url as string) || "");
    setWebhookOn(!!s.webhook_enabled);
    setSheetsId((s.sheets_spreadsheet_id as string) || "");
    setSheetsOn(!!s.sheets_enabled);
    setDriveFolder((s.drive_folder_id as string) || "");
    setDriveOn(!!s.drive_enabled);
    setGoogleConnected(g.connected);

    if (g.connected) {
      const [sh, df] = await Promise.all([listSheets(), listDriveFolders()]);
      setSheets(sh.sheets || []);
      setDriveFolders(df.folders || []);
    }
  }, []);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const handleSave = async () => {
    await saveSettings({
      webhook_url: webhookUrl,
      webhook_enabled: webhookOn,
      sheets_spreadsheet_id: sheetsId,
      sheets_enabled: sheetsOn,
      drive_folder_id: driveFolder,
      drive_enabled: driveOn,
    });
    setStatus("Saved");
    setTimeout(() => setStatus(""), 2000);
  };

  const handleConnect = async () => {
    const ok = await openGoogleAuth();
    if (ok) {
      setGoogleConnected(true);
      const [sh, df] = await Promise.all([listSheets(), listDriveFolders()]);
      setSheets(sh.sheets || []);
      setDriveFolders(df.folders || []);
    }
  };

  const handleDisconnect = async () => {
    await disconnectGoogle();
    setGoogleConnected(false);
    setSheets([]);
    setDriveFolders([]);
  };

  const handleTestWebhook = async () => {
    setWebhookStatus("Sending...");
    const r = await testWebhook();
    setWebhookStatus(r.delivered ? "Delivered!" : "Failed");
    setTimeout(() => setWebhookStatus(""), 2000);
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 flex w-[min(420px,90vw)] flex-col border-l border-border bg-bg transition-transform duration-250 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-sm font-semibold">Integrations</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-muted hover:text-text"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Webhook */}
          <Section title="Webhook">
            <Label>URL</Label>
            <Input value={webhookUrl} onChange={setWebhookUrl} placeholder="https://your-app.com/webhook" />
            <Toggle label="Enabled" on={webhookOn} onToggle={setWebhookOn} />
            <SmallBtn onClick={handleTestWebhook}>Send test webhook</SmallBtn>
            {webhookStatus && <Status text={webhookStatus} />}
          </Section>

          {/* Google */}
          <Section title="Google Account">
            {!googleConnected ? (
              <button
                onClick={handleConnect}
                className="w-full rounded-lg border border-border bg-surface py-2.5 text-[13px] text-text-2 hover:border-border-active"
              >
                Connect Google Account
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green" />
                <span className="text-[13px] text-text-2">Connected</span>
                <button
                  onClick={handleDisconnect}
                  className="ml-auto rounded border border-border px-2 py-0.5 text-[11px] text-text-faint hover:text-text"
                >
                  Disconnect
                </button>
              </div>
            )}
          </Section>

          {/* Sheets */}
          {googleConnected && (
            <Section title="Google Sheets">
              <Label>Export to</Label>
              <select
                value={sheetsId}
                onChange={(e) => setSheetsId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none"
              >
                <option value="">Select a spreadsheet...</option>
                {sheets.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Toggle label="Auto-append rows" on={sheetsOn} onToggle={setSheetsOn} />
            </Section>
          )}

          {/* Drive */}
          {googleConnected && (
            <Section title="Google Drive">
              <Label>Watch folder</Label>
              <select
                value={driveFolder}
                onChange={(e) => setDriveFolder(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none"
              >
                <option value="">Select a folder...</option>
                {driveFolders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <Toggle label="Enable folder sync" on={driveOn} onToggle={setDriveOn} />
            </Section>
          )}

          <button
            onClick={handleSave}
            className="mt-4 w-full rounded-lg bg-text py-2.5 text-[13px] font-semibold text-bg hover:opacity-90"
          >
            Save settings
          </button>
          {status && <Status text={status} />}
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        {title}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-text-faint">{children}</div>;
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none placeholder:text-text-faint focus:border-border-active"
    />
  );
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[13px] text-text-2">{label}</span>
      <button
        onClick={() => onToggle(!on)}
        className={`relative h-5 w-9 rounded-full border transition-colors ${
          on ? "border-green bg-green" : "border-border bg-surface-3"
        }`}
      >
        <div
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-text transition-transform ${
            on ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function SmallBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-border py-2 text-xs text-text-muted hover:border-border-active hover:text-text"
    >
      {children}
    </button>
  );
}

function Status({ text }: { text: string }) {
  return <div className="mt-1 font-mono text-[11px] text-green">{text}</div>;
}
