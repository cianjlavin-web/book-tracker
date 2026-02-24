"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { USER_ID } from "@/lib/user";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/components/ThemeProvider";

interface Profile {
  id: string;
  username: string | null;
  yearly_goal: number;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [yearlyGoal, setYearlyGoal] = useState("50");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const { theme: activeThemeObj, setThemeById, colorMode, setColorMode } = useTheme();

  const loadProfile = useCallback(async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("profiles")
      .select("id, username, yearly_goal")
      .eq("id", USER_ID)
      .single();

    if (data) {
      setProfile(data);
      setUsername(data.username ?? "");
      setYearlyGoal(String(data.yearly_goal ?? 50));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ username, yearly_goal: parseInt(yearlyGoal) || 50 })
      .eq("id", profile.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-4">
      <div className="pt-6 pb-4">
        <p className="text-xs text-white/80 uppercase tracking-wider mb-1">App</p>
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold text-white">Settings</h1>
      </div>

      {loading ? (
        <div className="h-48 bg-white/20 rounded-[20px] animate-pulse" />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Profile */}
          <Card>
            <p className="text-sm font-semibold text-[#1A1A1A] mb-4">Profile</p>
            <div className="flex flex-col gap-4">
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="bookworm42"
              />
            </div>
          </Card>

          {/* Reading Goal */}
          <Card>
            <p className="text-sm font-semibold text-[#1A1A1A] mb-1">Yearly Reading Goal</p>
            <p className="text-xs text-[#6B6B6B] mb-4">How many books do you want to read this year?</p>
            <Input
              type="number"
              value={yearlyGoal}
              onChange={(e) => setYearlyGoal(e.target.value)}
              min={1}
              max={1000}
              placeholder="50"
            />
          </Card>

          {/* Save */}
          <Button onClick={saveProfile} disabled={saving} size="lg" className="w-full">
            {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
          </Button>

          {/* Theme */}
          <Card>
            <p className="text-sm font-semibold text-[#1A1A1A] mb-1">Color Theme</p>
            <p className="text-xs text-[#6B6B6B] mb-4">Personalise the look of your app</p>
            <div className="flex gap-4 flex-wrap">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setThemeById(theme.id)}
                  className="flex flex-col items-center gap-1.5 transition-transform"
                  style={{ transform: activeThemeObj.id === theme.id ? "scale(1.1)" : "scale(1)" }}
                  title={theme.name}
                >
                  <div
                    className="w-12 h-12 rounded-full shadow-md transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                      outline: activeThemeObj.id === theme.id ? `3px solid ${theme.accent}` : "3px solid transparent",
                      outlineOffset: "2px",
                    }}
                  />
                  <span className="text-xs text-[#1A1A1A] font-medium">{theme.name}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Appearance */}
          <Card>
            <p className="text-sm font-semibold text-[#1A1A1A] mb-1">Appearance</p>
            <p className="text-xs text-[#6B6B6B] mb-4">Switch between light and dark cards</p>
            <div className="flex gap-2">
              {(["light", "dark"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setColorMode(mode)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all capitalize"
                  style={
                    colorMode === mode
                      ? { background: activeThemeObj.accent, color: "#fff" }
                      : { background: "var(--color-border-subtle)", color: "var(--color-muted)" }
                  }
                >
                  {mode === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </Card>

          {/* Import */}
          <Card>
            <p className="text-sm font-semibold text-[#1A1A1A] mb-1">Goodreads Import</p>
            <p className="text-xs text-[#6B6B6B] mb-3">Import your reading history from a Goodreads CSV export</p>
            <Link href="/import">
              <Button variant="secondary" className="w-full">Go to Import</Button>
            </Link>
          </Card>

          {/* App info */}
          <div className="text-center text-xs text-white/65 pb-4">
            <p>Book Tracker · Built with Next.js + Supabase</p>
          </div>
        </div>
      )}
    </div>
  );
}
