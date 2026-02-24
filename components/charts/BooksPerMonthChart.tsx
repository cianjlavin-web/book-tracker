"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface MonthData {
  month: string;
  books: number;
}

export function BooksPerMonthChart({ data }: { data: MonthData[] }) {
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
            tick={{ fontSize: 11, fill: "#6B6B6B" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#6B6B6B" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ background: "#F7F4F0", border: "none", borderRadius: "12px", fontSize: "12px" }}
            formatter={(v) => [`${v ?? 0} books`, "Finished"]}
          />
          <Bar dataKey="books" radius={[8, 8, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.books === max ? theme.accent : theme.accentLight} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
