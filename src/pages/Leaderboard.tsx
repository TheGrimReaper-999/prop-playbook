import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, TrendingUp, Target, Medal, Crown, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useStatTypeLeaderboard, usePlayerLeaderboard } from '@/hooks/useLeaderboard';

const STAT_TYPE_LABELS: Record<string, string> = {
  pts: 'Points',
  reb: 'Rebounds',
  ast: 'Assists',
  '3pm': '3-Pointers Made',
  stl: 'Steals',
  blk: 'Blocks',
  pra: 'Pts+Reb+Ast',
  pr: 'Pts+Reb',
  pa: 'Pts+Ast',
  ra: 'Reb+Ast',
  'stl+blk': 'Stocks',
};

function getRankIcon(index: number) {
  if (index === 0) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
  if (index === 2) return <Award className="h-5 w-5 text-amber-600" />;
  return <span className="text-muted-foreground font-mono w-5 text-center">{index + 1}</span>;
}

function getWinRateColor(rate: number): string {
  if (rate >= 70) return 'text-green-500';
  if (rate >= 50) return 'text-yellow-500';
  return 'text-red-500';
}

function getProgressColor(rate: number): string {
  if (rate >= 70) return 'bg-green-500';
  if (rate >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const { data: statTypes, isLoading: statTypesLoading } = useStatTypeLeaderboard();
  const { data: players, isLoading: playersLoading } = usePlayerLeaderboard();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Prediction Leaderboard</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stat Types Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Top Stat Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statTypesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : statTypes && statTypes.length > 0 ? (
              <div className="space-y-3">
                {statTypes.map((stat, index) => (
                  <div
                    key={stat.stat_type}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(index)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium truncate">
                          {STAT_TYPE_LABELS[stat.stat_type] || stat.stat_type.toUpperCase()}
                        </span>
                        <span className={`font-bold ${getWinRateColor(stat.win_rate)}`}>
                          {stat.win_rate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={stat.win_rate} 
                          className="h-2 flex-1"
                          style={{ 
                            ['--progress-background' as string]: getProgressColor(stat.win_rate) 
                          }}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {stat.wins}W - {stat.losses}L
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No prediction data yet. Start making picks to see your stats!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Player Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Top Players by Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {playersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : players && players.length > 0 ? (
              <div className="space-y-2">
                {players.slice(0, 15).map((player, index) => (
                  <div
                    key={player.player_name}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => player.player_id && navigate(`/player/${player.player_id}`)}
                  >
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(index)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{player.player_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {player.wins}W - {player.losses}L
                          </span>
                          <span className={`font-bold ${getWinRateColor(player.win_rate)}`}>
                            {player.win_rate.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No player prediction data yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {statTypes && players && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {statTypes.reduce((sum, s) => sum + s.total, 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Predictions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-500">
                    {statTypes.reduce((sum, s) => sum + s.wins, 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Wins</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-500">
                    {statTypes.reduce((sum, s) => sum + s.losses, 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Losses</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
