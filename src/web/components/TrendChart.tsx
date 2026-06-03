import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type TrendChartProps<T extends { label: string }> = {
  title: string;
  data: T[];
  lines: Array<{
    dataKey: keyof T;
    label: string;
    color: string;
  }>;
};

export function TrendChart<T extends { label: string }>({
  title,
  data,
  lines
}: TrendChartProps<T>) {
  return (
    <section className="chart-panel">
      <h2>{title}</h2>
      {data.length > 0 ? (
        <div className="chart-box" aria-label={title}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 12, right: 18, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis dataKey="label" tickMargin={8} />
              <YAxis width={44} />
              <Tooltip />
              {lines.map((line) => (
                <Line
                  key={String(line.dataKey)}
                  type="monotone"
                  dataKey={line.dataKey as string}
                  name={line.label}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="empty-state">まだ記録はありません。</p>
      )}
    </section>
  );
}
