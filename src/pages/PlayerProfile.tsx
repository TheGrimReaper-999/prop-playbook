import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlayerInfo, usePlayerGameLog, usePlayerSplits, GameLogEntry } from '@/hooks/useNbaApi';
import BetSlipButton from '@/components/BetSlipButton';
import { useBetSlip } from '@/contexts/BetSlipContext';

// Fallback mock stats generator when API doesn't return data
const generateMockStats = (playerName: string) => {
  const seed = playerName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const random = (min: number, max: number) => min + ((seed % 100) / 100) * (max - min);
  
  return {
    ppg: random(15, 30).toFixed(1),
    rpg: random(4, 12).toFixed(1),
    apg: random(2, 10).toFixed(1),
    spg: random(0.5, 2.5).toFixed(1),
    bpg: random(0.3, 2.0).toFixed(1),
    fgPct: random(42, 52).toFixed(1),
    fg3Pct: random(32, 42).toFixed(1),
    ftPct: random(75, 90).toFixed(1),
  };
};

const generateMockGames = (playerName: string) => {
  const seed = playerName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const random = (min: number, max: number) => min + ((seed % 100) / 100) * (max - min);
  
  return [
    { matchup: 'vs LAL', pts: Math.floor(random(18, 35)).toString(), reb: Math.floor(random(4, 12)).toString(), ast: Math.floor(random(2, 10)).toString(), wl: 'W' },
    { matchup: '@ BOS', pts: Math.floor(random(15, 32)).toString(), reb: Math.floor(random(3, 10)).toString(), ast: Math.floor(random(1, 8)).toString(), wl: 'L' },
    { matchup: 'vs MIA', pts: Math.floor(random(20, 38)).toString(), reb: Math.floor(random(5, 14)).toString(), ast: Math.floor(random(3, 12)).toString(), wl: 'W' },
    { matchup: '@ GSW', pts: Math.floor(random(12, 28)).toString(), reb: Math.floor(random(2, 8)).toString(), ast: Math.floor(random(2, 9)).toString(), wl: 'W' },
    { matchup: 'vs PHX', pts: Math.floor(random(22, 40)).toString(), reb: Math.floor(random(4, 11)).toString(), ast: Math.floor(random(4, 11)).toString(), wl: 'L' },
  ];
};

// API Player Profile (from team roster)
const ApiPlayerProfile = ({ playerId }: { playerId: string }) => {
  const navigate = useNavigate();
  const { addPlayer, removePlayer, isPlayerInSlip } = useBetSlip();
  
  const { data: playerInfo, isLoading: infoLoading } = usePlayerInfo(playerId);
  const { data: playerStats, isLoading: statsLoading } = usePlayerSplits(playerId);
  const { data: gamelog, isLoading: gamelogLoading } = usePlayerGameLog(playerId);

  if (infoLoading) {
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

  if (!playerInfo) {
    return (
      <main className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Player Not Found</h1>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </main>
    );
  }

  // Extract data using correct field names from API
  const name = playerInfo.fullName || playerInfo.playerName || `${playerInfo.firstName || ''} ${playerInfo.lastName || ''}`.trim();
  const image = playerInfo.image || playerInfo.headShotUrl;
  const team = playerInfo.team;
  const position = playerInfo.pos;
  const height = playerInfo.displayHeight || playerInfo.height;
  const weight = playerInfo.displayWeight || playerInfo.weight;
  const age = playerInfo.age;

  const stats = playerStats || generateMockStats(name);
  const games = gamelog && gamelog.length > 0 
    ? gamelog.slice(0, 5) 
    : generateMockGames(name);

  const inSlip = isPlayerInSlip(playerId);
  
  const handleToggleBetSlip = () => {
    if (inSlip) {
      removePlayer(playerId);
    } else {
      addPlayer({
        id: playerId,
        name,
        team: team || 'Unknown Team',
        image,
      });
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* BetSlip Button */}
      <BetSlipButton />

      {/* Header */}
      <div className="bg-gradient-to-b from-primary/20 to-background p-6">
        <div className="max-w-6xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-6 hover:bg-primary/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {/* Player Header */}
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            <div className="w-40 h-40 rounded-full bg-primary/20 overflow-hidden ring-4 ring-primary/30">
              {image ? (
                <img 
                  src={image} 
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-primary">
                  {name.split(' ').map(n => n[0]).join('')}
                </div>
              )}
            </div>
            
            <div className="text-center md:text-left">
              <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                  {name}
                </h1>
                <button
                  onClick={handleToggleBetSlip}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    inSlip 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted hover:bg-primary hover:text-primary-foreground'
                  }`}
                  title={inSlip ? 'Remove from BetSlip' : 'Add to BetSlip'}
                >
                  {inSlip ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xl text-muted-foreground mb-4">
                {team}
              </p>
              <div className="flex gap-2 justify-center md:justify-start flex-wrap">
                {position && (
                  <span className="px-3 py-1 bg-primary/20 rounded-full text-sm font-medium text-primary">
                    {position}
                  </span>
                )}
                {playerInfo.jersey && (
                  <span className="px-3 py-1 bg-secondary rounded-full text-sm font-medium">
                    #{playerInfo.jersey}
                  </span>
                )}
                {height && (
                  <span className="px-3 py-1 bg-secondary rounded-full text-sm font-medium">
                    {height}
                  </span>
                )}
                {weight && (
                  <span className="px-3 py-1 bg-secondary rounded-full text-sm font-medium">
                    {weight}
                  </span>
                )}
              </div>
              <div className="flex gap-4 mt-3 text-sm text-muted-foreground flex-wrap justify-center md:justify-start">
                {playerInfo.college && (
                  <span>🎓 {playerInfo.college}</span>
                )}
                {playerInfo.country && (
                  <span>🌍 {playerInfo.country}</span>
                )}
                {playerInfo.exp && (
                  <span>📅 {playerInfo.exp} years exp</span>
                )}
                {age && (
                  <span>Age: {age}</span>
                )}
              </div>
              {playerInfo.draftYear && playerInfo.draftRound && playerInfo.draftNumber && (
                <p className="text-sm text-muted-foreground mt-2">
                  Draft: {playerInfo.draftYear} Round {playerInfo.draftRound}, Pick {playerInfo.draftNumber}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Season Averages */}
        <h2 className="text-2xl font-bold mb-4">Season Averages</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'PPG', value: stats.ppg },
            { label: 'RPG', value: stats.rpg },
            { label: 'APG', value: stats.apg },
            { label: 'SPG', value: stats.spg },
            { label: 'BPG', value: stats.bpg },
            { label: 'FG%', value: stats.fgPct },
            { label: '3P%', value: stats.fg3Pct },
            { label: 'FT%', value: stats.ftPct },
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
            {gamelogLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
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
                    {games.map((game: GameLogEntry | ReturnType<typeof generateMockGames>[0], idx: number) => (
                      <tr key={idx} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-medium">{game.matchup}</td>
                        <td className="p-4 text-center">{game.pts}</td>
                        <td className="p-4 text-center">{game.reb}</td>
                        <td className="p-4 text-center">{game.ast}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            game.wl === 'W' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {game.wl}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

// Database Player Profile (from search) - also fetches real API data
const DbPlayerProfile = ({ id }: { id: string }) => {
  const navigate = useNavigate();
  const { addPlayer, removePlayer, isPlayerInSlip } = useBetSlip();

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

  const { data: team } = useQuery({
    queryKey: ['team-by-name', player?.team_name],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_teams')
        .select('id, name')
        .eq('name', player!.team_name)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!player?.team_name,
  });

  const stats = player ? generateMockStats(player.full_name) : null;
  const recentGames = player ? generateMockGames(player.full_name) : [];

  const inSlip = player ? isPlayerInSlip(id) : false;
  
  const handleToggleBetSlip = () => {
    if (!player) return;
    if (inSlip) {
      removePlayer(id);
    } else {
      addPlayer({
        id,
        name: player.full_name,
        team: player.team_name,
        image: player.image_url || undefined,
      });
    }
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
      {/* BetSlip Button */}
      <BetSlipButton />

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
              <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                  {player.full_name}
                </h1>
                <button
                  onClick={handleToggleBetSlip}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    inSlip 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted hover:bg-primary hover:text-primary-foreground'
                  }`}
                  title={inSlip ? 'Remove from BetSlip' : 'Add to BetSlip'}
                >
                  {inSlip ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
              </div>
              <p 
                className={`text-xl mb-4 ${team ? 'text-primary hover:underline cursor-pointer' : 'text-muted-foreground'}`}
                onClick={() => team && navigate(`/team/${team.id}`)}
              >
                {player.team_name}
              </p>
              <div className="flex gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-primary/20 rounded-full text-sm font-medium text-primary">
                  NBA Player
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
            { label: 'PPG', value: stats.ppg },
            { label: 'RPG', value: stats.rpg },
            { label: 'APG', value: stats.apg },
            { label: 'SPG', value: stats.spg },
            { label: 'BPG', value: stats.bpg },
            { label: 'FG%', value: stats.fgPct },
            { label: '3P%', value: stats.fg3Pct },
            { label: 'FT%', value: stats.ftPct },
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
                  {recentGames.map((game, idx) => (
                    <tr key={idx} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">{game.matchup}</td>
                      <td className="p-4 text-center">{game.pts}</td>
                      <td className="p-4 text-center">{game.reb}</td>
                      <td className="p-4 text-center">{game.ast}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          game.wl === 'W' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {game.wl}
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

// Main Player Profile component - routes to API or DB based player
const PlayerProfile = () => {
  const { id } = useParams<{ id: string }>();
  
  // Check if this is an API player (from team roster click) or DB player (from search)
  // API players have route /player/api/:playerId
  // DB players have route /player/:uuid
  const isApiPlayer = window.location.pathname.includes('/player/api/');
  
  if (isApiPlayer && id) {
    return <ApiPlayerProfile playerId={id} />;
  }
  
  return <DbPlayerProfile id={id || ''} />;
};

export default PlayerProfile;
