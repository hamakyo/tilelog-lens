import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import { formatRate } from "../lib/format";

type RankRatePieChartProps = {
  title: string;
  rates:
    | {
        first_rate: number;
        second_rate: number;
        third_rate: number;
        fourth_rate: number;
      }
    | undefined;
};

const rankRateColors = ["#147d64", "#2f6fed", "#b47b00", "#b23b3b"];

export function RankRatePieChart({ title, rates }: RankRatePieChartProps) {
  const data = rates
    ? [
        { name: "1位率", value: rates.first_rate },
        { name: "2位率", value: rates.second_rate },
        { name: "3位率", value: rates.third_rate },
        { name: "4位率", value: rates.fourth_rate }
      ]
    : [];

  return (
    <section className="chart-panel rank-rate-panel">
      <h2>{title}</h2>
      {data.length > 0 ? (
        <>
          <div className="chart-box" aria-label={title}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="48%"
                  innerRadius={54}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={rankRateColors[index]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatRate(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="table-scroll compact-table">
            <table>
              <thead>
                <tr>
                  <th>順位</th>
                  <th>割合</th>
                </tr>
              </thead>
              <tbody>
                {data.map((entry) => (
                  <tr key={entry.name}>
                    <td>{entry.name}</td>
                    <td>{formatRate(entry.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="empty-state">まだ記録はありません。</p>
      )}
    </section>
  );
}
