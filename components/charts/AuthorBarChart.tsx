"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface AuthorData {
  name: string;
  books: number;
}

export function AuthorBarChart({ data }: { data: AuthorData[] }) {
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
            tick={{ fontSize: 11, fill: "#6B6B6B" }}
            width={100}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#F7F4F0", border: "none", borderRadius: "12px", fontSize: "12px" }}
            formatter={(v) => [`${v ?? 0} books`, "Books"]}
          />
          <Bar dataKey="books" radius={[0, 8, 8, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? theme.accent : theme.accentLight} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
