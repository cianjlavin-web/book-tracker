"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface AuthorData {
  name: string;
  books: number;
}

interface AuthorBarChartProps {
  data: AuthorData[];
  selectedName?: string;
  onSelect?: (name: string) => void;
}

type ChartPayload = { name?: string; [key: string]: unknown };

export function AuthorBarChart({ data, selectedName, onSelect }: AuthorBarChartProps) {
  const { theme } = useTheme();

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-[#6B6B6B]">No data yet</div>;
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--color-muted)" }}
            width={100}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: "var(--color-card)", border: "none", borderRadius: "12px", fontSize: "12px", color: "var(--color-text)" }}
            formatter={(v) => [`${v ?? 0} books`, "Books"]}
          />
          <Bar
            dataKey="books"
            radius={[0, 8, 8, 0]}
            style={{ cursor: onSelect ? "pointer" : "default" }}
            onClick={(payload) => {
              const name = (payload as unknown as ChartPayload).name;
              if (name && onSelect) onSelect(name);
            }}
          >
            {data.map((entry, i) => {
              const fill = selectedName
                ? entry.name === selectedName ? theme.accent : theme.accentPale
                : i === 0 ? theme.accent : theme.accentLight;
              return <Cell key={i} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
