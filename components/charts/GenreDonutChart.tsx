"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface GenreData {
  name: string;
  value: number;
}

interface GenreDonutChartProps {
  data: GenreData[];
  selectedName?: string;
  onSelect?: (name: string) => void;
}

type ChartPayload = { name?: string; [key: string]: unknown };

export function GenreDonutChart({ data, selectedName, onSelect }: GenreDonutChartProps) {
  const { theme } = useTheme();
  const COLORS = [
    theme.accent,
    theme.accentLight,
    theme.gradientTo,
    theme.accentPale,
    "#9CA3AF",
    "#D1D5DB",
    "#6B7280",
  ];

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-[#6B6B6B]">No data yet</div>;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
            style={{ cursor: onSelect ? "pointer" : "default" }}
            onClick={(payload) => {
              const name = (payload as ChartPayload).name;
              if (name && onSelect) onSelect(name);
            }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                opacity={selectedName && selectedName !== entry.name ? 0.35 : 1}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "var(--color-card)", border: "none", borderRadius: "12px", fontSize: "12px", color: "var(--color-text)" }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: "11px", color: "var(--color-muted)" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
