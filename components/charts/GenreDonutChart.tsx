"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface GenreData {
  name: string;
  value: number;
}

export function GenreDonutChart({ data }: { data: GenreData[] }) {
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
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#F7F4F0", border: "none", borderRadius: "12px", fontSize: "12px" }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: "11px", color: "#6B6B6B" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
