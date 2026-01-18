import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Mock recent stats - in production, these would come from an API
const generateMockStats = (playerName: string) => {
  const seed = playerName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const random = (min: number, max: number) => min + ((seed % 100) / 100) * (max - min);
  
  return {
    season: {
      ppg: random(15, 30).toFixed(1),
      rpg: random(4, 12).toFixed(1),
      apg: random(2, 10).toFixed(1),
      spg: random(0.5, 2.5).toFixed(1),
      bpg: random(0.3, 2.0).toFixed(1),
      fgPct: random(42, 52).toFixed(1),
      threePct: random(32, 42).toFixed(1),
      ftPct: random(75, 90).toFixed(1),
    },
    recentGames: [
      { opponent: 'vs LAL', pts: Math.floor(random(18, 35)), reb: Math.floor(random(4, 12)), ast: Math.floor(random(2, 10)), result: 'W' },
      { opponent: '@ BOS', pts: Math.floor(random(15, 32)), reb: Math.floor(random(3, 10)), ast: Math.floor(random(1, 8)), result: 'L' },
      { opponent: 'vs MIA', pts: Math.floor(random(20, 38)), reb: Math.floor(random(5, 14)), ast: Math.floor(random(3, 12)), result: 'W' },
      { opponent: '@ GSW', pts: Math.floor(random(12, 28)), reb: Math.floor(random(2, 8)), ast: Math.floor(random(2, 9)), result: 'W' },
      { opponent: 'vs PHX', pts: Math.floor(random(22, 40)), reb: Math.floor(random(4, 11)), ast: Math.floor(random(4, 11)), result: 'L' },
    ],
  };
};

const PlayerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: player, isLoading } = useQuery({
    queryKey: ['player', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_players')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const stats = player ? generateMockStats(player.full_name) : null;

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (value < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-10 w-32 mb-8" />
          <div className="flex gap-8 items-start">
            <Skeleton className="w-48 h-48 rounded-full" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-12 w-64" />
              <Skeleton className="h-6 w-48" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!player) {
    return (
      <main className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Player Not Found</h1>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/20 to-background p-6">
        <div className="max-w-6xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-6 hover:bg-primary/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Button>

          {/* Player Header */}
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            <div className="w-40 h-40 rounded-full bg-primary/20 overflow-hidden ring-4 ring-primary/30">
              {player.image_url ? (
                <img 
                  src={player.image_url} 
                  alt={player.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-primary">
                  {player.full_name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
            </div>
            
            <div className="text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">
                {player.full_name}
              </h1>
              <p className="text-xl text-muted-foreground mb-4">{player.team_name}</p>
              <div className="flex gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-primary/20 rounded-full text-sm font-medium text-primary">
                  Guard
                </span>
                <span className="px-3 py-1 bg-secondary rounded-full text-sm font-medium">
                  #23
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Season Averages */}
        <h2 className="text-2xl font-bold mb-4">Season Averages</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats && [
            { label: 'PPG', value: stats.season.ppg },
            { label: 'RPG', value: stats.season.rpg },
            { label: 'APG', value: stats.season.apg },
            { label: 'SPG', value: stats.season.spg },
            { label: 'BPG', value: stats.season.bpg },
            { label: 'FG%', value: stats.season.fgPct },
            { label: '3P%', value: stats.season.threePct },
            { label: 'FT%', value: stats.season.ftPct },
          ].map((stat) => (
            <Card key={stat.label} className="bg-card/50 border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Games */}
        <h2 className="text-2xl font-bold mb-4">Recent Games</h2>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-4 font-semibold">Game</th>
                    <th className="text-center p-4 font-semibold">PTS</th>
                    <th className="text-center p-4 font-semibold">REB</th>
                    <th className="text-center p-4 font-semibold">AST</th>
                    <th className="text-center p-4 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentGames.map((game, idx) => (
                    <tr key={idx} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">{game.opponent}</td>
                      <td className="p-4 text-center">{game.pts}</td>
                      <td className="p-4 text-center">{game.reb}</td>
                      <td className="p-4 text-center">{game.ast}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          game.result === 'W' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {game.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default PlayerProfile;
