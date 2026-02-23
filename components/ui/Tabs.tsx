"use client";

import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex gap-1 bg-white/20 rounded-full p-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex-1 text-sm font-medium rounded-full px-3 py-1.5 transition-all",
            activeTab === tab.id
              ? "bg-[#E8599A] text-white shadow-sm"
              : "text-white/85 hover:text-white"
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1 text-xs opacity-80">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}

interface PillFilterProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}

export function PillFilter({ options, value, onChange }: PillFilterProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "text-sm font-medium rounded-full px-4 py-1.5 transition-all border",
            value === opt
              ? "bg-[#E8599A] text-white border-[#E8599A]"
              : "bg-white/20 text-white border-white/30 hover:bg-white/30"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
