import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GameLogEntry } from '@/hooks/useNbaApi';
import { calculateMA, calculateEMA, extractStatValues, getStatValuesForType } from '@/hooks/usePlayerStats';

const STAT_TYPE_LABELS: Record<string, string> = {
  pts: 'Points',
  reb: 'Rebounds',
  ast: 'Assists',
  '3pm': '3-Pointers Made',
  pra: 'Pts + Reb + Ast',
  pr: 'Pts + Reb',
  pa: 'Pts + Ast',
  ra: 'Reb + Ast',
};

interface StatsChartProps {
  games: GameLogEntry[];
  statType: string;
  mainLine?: number;
  playerName: string;
}

const StatsChart = ({ games, statType, mainLine, playerName }: StatsChartProps) => {
  const chartData = useMemo(() => {
    if (!games.length || !statType) return [];

    const statValues = extractStatValues(games);
    const values = getStatValuesForType(statValues, statType, 10);
    
    // values are most recent first, we need oldest to recent for chart
    const chronologicalValues = [...values].reverse();
    const chronologicalGames = [...games].reverse();
    
    // Calculate MA (5-period) - returns oldest to recent
    const ma5 = calculateMA(values, 5);
    
    // Calculate EMA - returns oldest to recent, only last 5 have values
    const ema5 = calculateEMA(values, 5);

    return chronologicalValues.map((value, index) => {
      const game = chronologicalGames[index];
      const dateStr = game?.gameDate || '';
      const formattedDate = dateStr
        ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : `Game ${index + 1}`;

      return {
        name: formattedDate,
        opponent: game?.opponent || '',
        value,
        ma5: isNaN(ma5[index]) ? null : ma5[index],
        ema5: isNaN(ema5[index]) ? null : ema5[index],
      };
    });
  }, [games, statType]);

  if (!chartData.length) {
    return (
      <Card className="bg-background/50">
        <CardContent className="p-6 text-center text-muted-foreground">
          No game data available
        </CardContent>
      </Card>
    );
  }

  const statLabel = STAT_TYPE_LABELS[statType] || statType;
  const maxValue = Math.max(...chartData.map((d) => d.value), mainLine || 0) * 1.1;
  const minValue = Math.min(...chartData.map((d) => d.value), mainLine || Infinity) * 0.9;

  return (
    <Card className="bg-background/50 border-border/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {playerName} - Last 10 Games ({statLabel})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div style={{ width: '100%', height: 256 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <YAxis
                domain={[Math.floor(minValue), Math.ceil(maxValue)]}
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    value: statLabel,
                    ma5: 'MA (5)',
                    ema5: 'EMA (5)',
                  };
                  return [value?.toFixed(1), labels[name] || name];
                }}
              />
              <Legend />
              
              {/* Main Line Reference */}
              {mainLine && (
                <ReferenceLine
                  y={mainLine}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{
                    value: `Line: ${mainLine}`,
                    position: 'right',
                    fill: 'hsl(var(--primary))',
                    fontSize: 11,
                  }}
                />
              )}

              {/* Actual stat values */}
              <Line
                type="monotone"
                dataKey="value"
                name={statLabel}
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--foreground))', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
              />

              {/* Moving Average (5-period) */}
              <Line
                type="monotone"
                dataKey="ma5"
                name="MA (5)"
                stroke="hsl(142 76% 36%)"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
                connectNulls={false}
              />

              {/* EMA (5-period) - only plotted over recent 5 games */}
              <Line
                type="monotone"
                dataKey="ema5"
                name="EMA (5)"
                stroke="hsl(221 83% 53%)"
                strokeWidth={2}
                strokeDasharray="5 2"
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Game details table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-1">Date</th>
                <th className="text-left py-2 px-1">Opp</th>
                <th className="text-right py-2 px-1">{statLabel}</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((game, idx) => (
                <tr key={idx} className="border-b border-border/20">
                  <td className="py-1.5 px-1">{game.name}</td>
                  <td className="py-1.5 px-1 text-muted-foreground">{game.opponent}</td>
                  <td className={`py-1.5 px-1 text-right font-semibold ${
                    mainLine && game.value >= mainLine ? 'text-green-500' : 
                    mainLine && game.value < mainLine ? 'text-red-500' : ''
                  }`}>
                    {game.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsChart;
