"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface MonthData {
  month: string;
  books: number;
}

interface BooksPerMonthChartProps {
  data: MonthData[];
  selectedName?: string;
  onSelect?: (month: string) => void;
}

type ChartPayload = { month?: string; [key: string]: unknown };

export function BooksPerMonthChart({ data, selectedName, onSelect }: BooksPerMonthChartProps) {
  const { theme } = useTheme();

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-[#6B6B6B]">No data yet</div>;
  }

  const max = Math.max(...data.map((d) => d.books));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20, right: 8 }}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ background: "var(--color-card)", border: "none", borderRadius: "12px", fontSize: "12px", color: "var(--color-text)" }}
            formatter={(v) => [`${v ?? 0} books`, "Finished"]}
          />
          <Bar
            dataKey="books"
            radius={[8, 8, 0, 0]}
            style={{ cursor: onSelect ? "pointer" : "default" }}
            onClick={(payload) => {
              const month = (payload as unknown as ChartPayload).month;
              if (month && onSelect) onSelect(month);
            }}
          >
            {data.map((d, i) => {
              const fill = selectedName
                ? d.month === selectedName ? theme.accent : theme.accentPale
                : d.books === max ? theme.accent : theme.accentLight;
              return <Cell key={i} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
