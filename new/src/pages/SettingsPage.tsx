import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Link2,
  Unplug,
  Webhook,
  Table,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSettings,
  updateSettings,
  getGoogleAuthStatus,
  openGoogleAuth,
  disconnectGoogle,
  testWebhook,
  listSheets,
  getDriveFolders,
} from "@/lib/api";
import type { Settings as SettingsType, GoogleSheet, DriveFolder } from "@/types";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const [, setSettings] = useState<SettingsType | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sheets, setSheets] = useState<readonly GoogleSheet[]>([]);
  const [folders, setFolders] = useState<readonly DriveFolder[]>([]);
  const [webhookTestResult, setWebhookTestResult] = useState<
    boolean | null
  >(null);

  // Form state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [sheetsId, setSheetsId] = useState("");
  const [sheetsEnabled, setSheetsEnabled] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState("");
  const [driveEnabled, setDriveEnabled] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, auth] = await Promise.all([
          getSettings(),
          getGoogleAuthStatus(),
        ]);
        setSettings(s);
        setIsConnected(auth.connected);
        setWebhookUrl(s.webhook_url ?? "");
        setWebhookEnabled(s.webhook_enabled ?? false);
        setSheetsId(s.sheets_spreadsheet_id ?? "");
        setSheetsEnabled(s.sheets_enabled ?? false);
        setDriveFolderId(s.drive_folder_id ?? "");
        setDriveEnabled(s.drive_enabled ?? false);

        if (auth.connected) {
          const [sheetRes, folderRes] = await Promise.allSettled([
            listSheets(),
            getDriveFolders(),
          ]);
          if (sheetRes.status === "fulfilled") {
            setSheets(sheetRes.value.sheets);
          }
          if (folderRes.status === "fulfilled") {
            setFolders(folderRes.value.folders);
          }
        }
      } catch {
        // Settings load failed
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        webhook_url: webhookUrl || undefined,
        webhook_enabled: webhookEnabled,
        sheets_spreadsheet_id: sheetsId || undefined,
        sheets_enabled: sheetsEnabled,
        drive_folder_id: driveFolderId || undefined,
        drive_enabled: driveEnabled,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    webhookUrl,
    webhookEnabled,
    sheetsId,
    sheetsEnabled,
    driveFolderId,
    driveEnabled,
  ]);

  const handleConnect = useCallback(() => {
    const popup = openGoogleAuth();
    const handler = (e: MessageEvent) => {
      if (e.data === "google_connected") {
        setIsConnected(true);
        window.removeEventListener("message", handler);
        popup?.close();
      }
    };
    window.addEventListener("message", handler);
  }, []);

  const handleDisconnect = useCallback(async () => {
    await disconnectGoogle();
    setIsConnected(false);
  }, []);

  const handleTestWebhook = useCallback(async () => {
    setWebhookTestResult(null);
    try {
      const result = await testWebhook();
      setWebhookTestResult(result.delivered);
    } catch {
      setWebhookTestResult(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <div className="mb-8">
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure integrations and preferences
        </p>
      </div>

      {/* Google Account */}
      <SettingsSection icon={Link2} title="Google Account">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">
              {isConnected ? "Google account connected" : "Not connected"}
            </p>
            <p className="text-xs text-muted-foreground">
              Required for Drive, Gmail, Sheets, and Calendar
            </p>
          </div>
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-border text-red-400 hover:text-red-300"
              onClick={handleDisconnect}
            >
              <Unplug className="mr-1.5 h-3 w-3" />
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-8 text-xs bg-green-500 text-green-950 hover:bg-green-400"
              onClick={handleConnect}
            >
              Connect
            </Button>
          )}
        </div>
      </SettingsSection>

      <Separator className="my-6" />

      {/* Webhook */}
      <SettingsSection icon={Webhook} title="Webhook">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="webhook-enabled" className="text-sm">
              Enable webhook notifications
            </Label>
            <Switch
              id="webhook-enabled"
              checked={webhookEnabled}
              onCheckedChange={setWebhookEnabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-url" className="text-xs text-muted-foreground">
              Webhook URL
            </Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                value={webhookUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="h-9 text-sm bg-surface border-border"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0 text-xs border-border"
                onClick={handleTestWebhook}
                disabled={!webhookUrl}
              >
                Test
              </Button>
            </div>
            {webhookTestResult !== null && (
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  webhookTestResult ? "text-green-400" : "text-red-400"
                )}
              >
                {webhookTestResult ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {webhookTestResult ? "Delivered" : "Failed"}
              </div>
            )}
          </div>
        </div>
      </SettingsSection>

      <Separator className="my-6" />

      {/* Google Sheets */}
      <SettingsSection icon={Table} title="Google Sheets Export">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="sheets-enabled" className="text-sm">
              Auto-export to Sheets
            </Label>
            <Switch
              id="sheets-enabled"
              checked={sheetsEnabled}
              onCheckedChange={setSheetsEnabled}
              disabled={!isConnected}
            />
          </div>
          {isConnected && sheets.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Target Spreadsheet
              </Label>
              <Select value={sheetsId} onValueChange={(v) => v !== null && setSheetsId(v)}>
                <SelectTrigger className="h-9 text-sm bg-surface border-border">
                  <SelectValue placeholder="Select a spreadsheet" />
                </SelectTrigger>
                <SelectContent>
                  {sheets.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            !isConnected && (
              <p className="text-xs text-muted-foreground">
                Connect Google to select a spreadsheet
              </p>
            )
          )}
        </div>
      </SettingsSection>

      <Separator className="my-6" />

      {/* Drive Folder */}
      <SettingsSection icon={HardDrive} title="Drive Folder Watch">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="drive-enabled" className="text-sm">
              Watch folder for new PDFs
            </Label>
            <Switch
              id="drive-enabled"
              checked={driveEnabled}
              onCheckedChange={setDriveEnabled}
              disabled={!isConnected}
            />
          </div>
          {isConnected && folders.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Folder to Watch
              </Label>
              <Select value={driveFolderId} onValueChange={(v) => v !== null && setDriveFolderId(v)}>
                <SelectTrigger className="h-9 text-sm bg-surface border-border">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            !isConnected && (
              <p className="text-xs text-muted-foreground">
                Connect Google to select a folder
              </p>
            )
          )}
        </div>
      </SettingsSection>

      {/* Save button */}
      <div className="mt-8 flex justify-end">
        <Button
          className="bg-green-500 text-green-950 hover:bg-green-400"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  children,
}: {
  readonly icon: React.ElementType;
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}
