import path from "node:path";

import { AppSidebar } from "@/components/app-sidebar";
import { AppSettings } from "@/components/qa/app-settings";
import { readSettings, settingsDir } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const settings = readSettings();
  return (
    <div className="flex flex-1">
      <AppSidebar />
      <main className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
        <div className="font-heading font-semibold md:hidden">AutoQA</div>
        <AppSettings
          projects={settings.projects ?? []}
          current={settings.projectDir}
          settingsPath={path.join(settingsDir(), "config.json")}
        />
      </main>
    </div>
  );
}
