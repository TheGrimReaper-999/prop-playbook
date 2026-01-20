import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Plus, Check, ChevronRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlayerInfo, usePlayerGameLog, usePlayerSplits, GameLogEntry, PlayerStats } from '@/hooks/useNbaApi';
import { usePlayerDbStats } from '@/hooks/usePlayerDbStats';
import NavButtons from '@/components/NavButtons';
import BetSlipOverlay from '@/components/BetSlipOverlay';
import Footer from '@/components/Footer';
import { useBetSlip } from '@/contexts/BetSlipContext';

interface PlayerHeaderProps {
  name: string;
  image?: string | null;
  team?: string | null;
  teamId?: string | null;
  position?: string | null;
  jersey?: string | null;
  height?: string | null;
  weight?: string | null;
  age?: string | number | null;
  college?: string | null;
  country?: string | null;
  exp?: string | null;
  draftInfo?: string | null;
  playerId: string;
  apiPlayerId?: string | null;
  onNavigateTeam?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const PlayerHeader = ({
  name,
  image,
  team,
  position,
  jersey,
  height,
  weight,
  age,
  college,
  country,
  exp,
  draftInfo,
  playerId,
  apiPlayerId,
  onNavigateTeam,
  onRefresh,
  isRefreshing,
}: PlayerHeaderProps) => {
  const navigate = useNavigate();
  const { addPlayer, removePlayer, isPlayerInSlip } = useBetSlip();
  const inSlip = isPlayerInSlip(playerId);

  const handleToggleBetSlip = () => {
    if (inSlip) {
      removePlayer(playerId);
    } else {
      addPlayer({
        id: playerId,
        name,
        team: team || 'Unknown Team',
        image: image || undefined,
      });
    }
  };

  return (
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
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-muted hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                  title="Refresh player data"
                >
                  <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
            {team && (
              <p 
                className={`text-xl mb-4 ${onNavigateTeam ? 'text-primary hover:underline cursor-pointer' : 'text-muted-foreground'}`}
                onClick={onNavigateTeam}
              >
                {team}
              </p>
            )}
            <div className="flex gap-2 justify-center md:justify-start flex-wrap">
              {position && (
                <span className="px-3 py-1 bg-primary/20 rounded-full text-sm font-medium text-primary">
                  {position}
                </span>
              )}
              {jersey && (
                <span className="px-3 py-1 bg-secondary rounded-full text-sm font-medium">
                  #{jersey}
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
              {college && <span>🎓 {college}</span>}
              {country && <span>🌍 {country}</span>}
              {exp && <span>📅 {exp}</span>}
              {age && <span>Age: {age}</span>}
            </div>
            {draftInfo && (
              <p className="text-sm text-muted-foreground mt-2">
                Draft: {draftInfo}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SeasonStatsProps {
  stats: PlayerStats | null;
  isLoading: boolean;
  isFromDb?: boolean;
}

const SeasonStats = ({ stats, isLoading, isFromDb }: SeasonStatsProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <Card className="bg-card/50 border-border/50 mb-8">
        <CardContent className="p-6 text-center text-muted-foreground">
          No season stats available yet.
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    { label: 'PPG', value: stats.ppg },
    { label: 'RPG', value: stats.rpg },
    { label: 'APG', value: stats.apg },
    { label: 'SPG', value: stats.spg },
    { label: 'BPG', value: stats.bpg },
    { label: 'FG%', value: stats.fgPct },
    { label: '3P%', value: stats.fg3Pct },
    { label: 'FT%', value: stats.ftPct },
  ];

  return (
    <div className="space-y-2 mb-8">
      {isFromDb && (
        <p className="text-xs text-muted-foreground">
          * Based on last 10 games
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((stat) => (
          <Card key={stat.label} className="bg-card/50 border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary">{stat.value || '0'}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface RecentGamesProps {
  games: GameLogEntry[];
  isLoading: boolean;
  lastUpdated?: string;
}

// Helper to normalize matchup display to "vs OPP" format
const formatMatchup = (game: GameLogEntry): string => {
  const matchup = game.matchup || '';
  const abbrevMatch = matchup.match(/(?:vs|@)\s*(\w+)/i);
  if (abbrevMatch && abbrevMatch[1]) {
    return `vs ${abbrevMatch[1].toUpperCase()}`;
  }
  return matchup.replace(/^[@]\s*/i, 'vs ');
};

const RecentGames = ({ games, isLoading, lastUpdated }: RecentGamesProps) => {
  const navigate = useNavigate();

  const handleGameClick = (gameId: string) => {
    if (gameId) {
      navigate(`/matchup/${gameId}`);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!games || games.length === 0) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-6 text-center text-muted-foreground">
          No recent games available. Try refreshing the data.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-0">
        {lastUpdated && (
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs text-muted-foreground">
              Last game: {new Date(lastUpdated).toLocaleDateString()}
            </p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4 font-semibold">Game</th>
                <th className="text-center p-4 font-semibold">PTS</th>
                <th className="text-center p-4 font-semibold">REB</th>
                <th className="text-center p-4 font-semibold">AST</th>
                <th className="text-center p-4 font-semibold">3PM</th>
                <th className="text-center p-4 font-semibold">Result</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {games.slice(0, 10).map((game, idx) => (
                <tr 
                  key={idx} 
                  className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => handleGameClick(game.gameId)}
                >
                  <td className="p-4 font-medium">
                    <div className="flex items-center gap-2">
                      {game.opponentLogo && (
                        <img 
                          src={game.opponentLogo} 
                          alt="" 
                          className="w-6 h-6 object-contain"
                        />
                      )}
                      {formatMatchup(game)}
                    </div>
                  </td>
                  <td className="p-4 text-center">{game.pts}</td>
                  <td className="p-4 text-center">{game.reb}</td>
                  <td className="p-4 text-center">{game.ast}</td>
                  <td className="p-4 text-center">{game.fg3m}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      game.wl === 'W' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {game.wl || '-'}
                    </span>
                  </td>
                  <td className="p-2">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
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

// API Player Profile (from team roster click)
const ApiPlayerProfile = ({ playerId }: { playerId: string }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: playerInfo, isLoading: infoLoading } = usePlayerInfo(playerId);
  const { data: playerStats, isLoading: statsLoading } = usePlayerSplits(playerId);
  const { data: gamelog, isLoading: gamelogLoading } = usePlayerGameLog(playerId);

  // Mutation to sync player data
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('smart-sync', {
        body: { action: 'sync-player', apiPlayerId: playerId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Player data refreshed!');
      queryClient.invalidateQueries({ queryKey: ['player-gamelog', playerId] });
      queryClient.invalidateQueries({ queryKey: ['player-splits', playerId] });
    },
    onError: (error) => {
      toast.error('Failed to refresh data: ' + (error as Error).message);
    },
  });
  
  // Lookup team by name to get team ID for navigation
  const { data: teamData } = useQuery({
    queryKey: ['team-by-name-api', playerInfo?.team],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_teams')
        .select('id, name')
        .ilike('name', `%${playerInfo!.team}%`)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!playerInfo?.team,
  });

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

  const name = playerInfo.fullName || playerInfo.playerName || `${playerInfo.firstName || ''} ${playerInfo.lastName || ''}`.trim();
  const draftInfo = playerInfo.draftYear ? `${playerInfo.draftYear}` : undefined;

  return (
    <main className="min-h-screen bg-background">
      <NavButtons />
      <BetSlipOverlay />

      <PlayerHeader
        name={name}
        image={playerInfo.image || playerInfo.headShotUrl}
        team={playerInfo.team}
        position={playerInfo.pos}
        jersey={playerInfo.jersey}
        height={playerInfo.displayHeight || playerInfo.height}
        weight={playerInfo.displayWeight || playerInfo.weight}
        age={playerInfo.age}
        college={playerInfo.college}
        country={playerInfo.country}
        exp={playerInfo.exp}
        draftInfo={draftInfo}
        playerId={playerId}
        apiPlayerId={playerId}
        onNavigateTeam={teamData ? () => navigate(`/team/${teamData.id}`) : undefined}
        onRefresh={() => syncMutation.mutate()}
        isRefreshing={syncMutation.isPending}
      />

      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">Season Averages</h2>
        <SeasonStats stats={playerStats} isLoading={statsLoading} />

        <h2 className="text-2xl font-bold mb-4">Recent Games</h2>
        <RecentGames games={gamelog || []} isLoading={gamelogLoading} />
      </div>
    </main>
  );
};

// Database Player Profile (from search) - ALWAYS shows DB-backed stats
const DbPlayerProfile = ({ id }: { id: string }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch player info
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

  // Fetch team for navigation
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

  // Use the new DB stats hook - this will sync if needed
  const { 
    data: dbStats, 
    isLoading: dbStatsLoading,
    refetch: refetchDbStats
  } = usePlayerDbStats(
    player?.id || null,
    player?.full_name || '',
    player?.team_name
  );

  // Also fetch API stats if player has api_player_id (for season averages)
  const apiPlayerId = player?.api_player_id;
  const { data: apiStats, isLoading: apiStatsLoading } = usePlayerSplits(apiPlayerId || null);

  // Mutation to sync player data
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('smart-sync', {
        body: { 
          action: 'sync-player', 
          apiPlayerId: apiPlayerId, 
          dbPlayerId: id,
          playerName: player?.full_name,
          teamName: player?.team_name,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Player data refreshed!');
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['player', id] });
      queryClient.invalidateQueries({ queryKey: ['player-db-stats', id] });
      if (apiPlayerId) {
        queryClient.invalidateQueries({ queryKey: ['player-splits', apiPlayerId] });
      }
      // Refetch DB stats
      refetchDbStats();
    },
    onError: (error) => {
      toast.error('Failed to refresh data: ' + (error as Error).message);
    },
  });

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

  // Use API stats if available, otherwise use derived averages from DB games
  const displayStats = apiStats || dbStats?.derivedAverages || null;
  const isStatsFromDb = !apiStats && !!dbStats?.derivedAverages;
  const statsLoading = apiPlayerId ? apiStatsLoading : dbStatsLoading;

  // Always use DB games for recent games (our source of truth)
  const recentGames = dbStats?.games || [];
  const lastUpdated = recentGames.length > 0 ? recentGames[0].gameDate : undefined;

  return (
    <main className="min-h-screen bg-background">
      <NavButtons />
      <BetSlipOverlay />

      <PlayerHeader
        name={player.full_name}
        image={player.image_url}
        team={player.team_name}
        playerId={id}
        apiPlayerId={apiPlayerId}
        onNavigateTeam={team ? () => navigate(`/team/${team.id}`) : undefined}
        onRefresh={() => syncMutation.mutate()}
        isRefreshing={syncMutation.isPending}
      />

      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-4">Season Averages</h2>
        <SeasonStats 
          stats={displayStats} 
          isLoading={statsLoading} 
          isFromDb={isStatsFromDb}
        />

        <h2 className="text-2xl font-bold mb-4">Recent Games</h2>
        <RecentGames 
          games={recentGames} 
          isLoading={dbStatsLoading} 
          lastUpdated={lastUpdated}
        />
      </div>
      
      <Footer />
    </main>
  );
};

// Main Player Profile component
const PlayerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Guard against missing id
  if (!id) {
    return (
      <main className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Player ID</h1>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </main>
    );
  }
  
  // API players have route /player/api/:playerId
  // DB players have route /player/:uuid
  const isApiPlayer = window.location.pathname.includes('/player/api/');
  
  if (isApiPlayer) {
    return <ApiPlayerProfile playerId={id} />;
  }
  
  return <DbPlayerProfile id={id} />;
};

export default PlayerProfile;
