"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useTheme } from "@/components/ThemeProvider";

interface RatingData {
  rating: string;
  count: number;
}

interface RatingDistributionChartProps {
  data: RatingData[];
  selectedName?: string;
  onSelect?: (rating: string) => void;
}

type ChartPayload = { rating?: string; [key: string]: unknown };

export function RatingDistributionChart({ data, selectedName, onSelect }: RatingDistributionChartProps) {
  const { theme } = useTheme();

  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-[#6B6B6B]">No ratings yet</div>;
  }

  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20, right: 8 }}>
          <XAxis
            dataKey="rating"
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
            formatter={(v) => [`${v ?? 0} books`, "Books"]}
          />
          <Bar
            dataKey="count"
            radius={[8, 8, 0, 0]}
            style={{ cursor: onSelect ? "pointer" : "default" }}
            onClick={(payload) => {
              const rating = (payload as unknown as ChartPayload).rating;
              if (rating && onSelect) onSelect(rating);
            }}
          >
            {data.map((d, i) => {
              const fill = selectedName
                ? d.rating === selectedName ? theme.accent : theme.accentPale
                : d.count === max ? theme.accent : theme.accentLight;
              return <Cell key={i} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
