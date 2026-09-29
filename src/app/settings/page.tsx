import path from "node:path";

import { AppShell } from "@/components/app-shell";
import { AppSettings } from "@/components/qa/app-settings";
import { readSettings, settingsDir } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const settings = readSettings();
  return (
    <AppShell>
      <AppSettings
        projects={settings.projects ?? []}
        current={settings.projectDir}
        settingsPath={path.join(settingsDir(), "config.json")}
      />
    </AppShell>
  );
}
