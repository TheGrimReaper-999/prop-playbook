import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface PlayerStat {
  player_name: string;
  player_id: string | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  minutes: number | null;
}

interface GameDetails {
  id: string;
  event_id: string;
  game_date: string;
  home_team_name: string | null;
  home_team_abbrev: string | null;
  home_team_logo: string | null;
  home_team_score: number | null;
  away_team_name: string | null;
  away_team_abbrev: string | null;
  away_team_logo: string | null;
  away_team_score: number | null;
  status: string;
  status_detail: string | null;
  venue_name: string | null;
  venue_city: string | null;
}

const useGameDetails = (eventId: string) => {
  return useQuery({
    queryKey: ['game-details', eventId],
    queryFn: async (): Promise<GameDetails | null> => {
      const { data, error } = await supabase
        .from('nba_fixtures')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });
};

const useGamePlayerStats = (eventId: string) => {
  return useQuery({
    queryKey: ['game-player-stats', eventId],
    queryFn: async (): Promise<PlayerStat[]> => {
      const { data, error } = await supabase
        .from('nba_player_stats')
        .select('player_name, player_id, points, rebounds, assists, minutes')
        .eq('event_id', eventId)
        .order('points', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
  });
};

const useSyncGameStats = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.functions.invoke('populate-stats', {
        body: { action: 'sync-game-boxscore', eventId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['game-details', eventId] });
      queryClient.invalidateQueries({ queryKey: ['game-player-stats', eventId] });
    }
  });
};

const PlayerCard = ({ player, rank }: { player: PlayerStat; rank: number }) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (player.player_id) {
      navigate(`/player/api/${player.player_id}`);
    }
  };

  return (
    <Card 
      className={`bg-card/50 border-border/30 ${player.player_id ? 'cursor-pointer hover:bg-card/80' : ''} transition-colors`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-muted-foreground">#{rank}</span>
            <div>
              <p className="font-semibold">{player.player_name}</p>
              <p className="text-sm text-muted-foreground">{player.minutes || 0} MIN</p>
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-primary">{player.points || 0}</p>
              <p className="text-xs text-muted-foreground">PTS</p>
            </div>
            <div>
              <p className="text-lg font-bold">{player.rebounds || 0}</p>
              <p className="text-xs text-muted-foreground">REB</p>
            </div>
            <div>
              <p className="text-lg font-bold">{player.assists || 0}</p>
              <p className="text-xs text-muted-foreground">AST</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Matchup = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [hasSynced, setHasSynced] = useState(false);
  
  const { data: game, isLoading: gameLoading, refetch: refetchGame } = useGameDetails(eventId || '');
  const { data: playerStats, isLoading: statsLoading, refetch: refetchStats } = useGamePlayerStats(eventId || '');
  const syncMutation = useSyncGameStats();

  // Auto-sync if game is completed but no stats available
  useEffect(() => {
    if (game && !hasSynced && (game.status === 'post' || game.status_detail?.includes('Final')) && (!playerStats || playerStats.length === 0) && !statsLoading) {
      setHasSynced(true);
      syncMutation.mutate(eventId || '', {
        onSuccess: () => {
          toast.success('Game stats synced!');
        },
        onError: () => {
          // Silent fail - stats may not be available yet
        }
      });
    }
  }, [game, playerStats, statsLoading, hasSynced, eventId, syncMutation]);

  const handleManualSync = () => {
    if (eventId) {
      syncMutation.mutate(eventId, {
        onSuccess: (data) => {
          toast.success(data?.message || 'Game synced!');
          refetchGame();
          refetchStats();
        },
        onError: () => {
          toast.error('Failed to sync game data');
        }
      });
    }
  };

  if (gameLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-48 w-full mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const formatGameDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Games
        </Button>

        {game ? (
          <>
            {/* Game Header */}
            <Card className="bg-card/50 border-border/30 mb-6">
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">{formatGameDate(game.game_date)}</p>
                  {game.venue_name && (
                    <p className="text-xs text-muted-foreground">{game.venue_name}, {game.venue_city}</p>
                  )}
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm ${
                    game.status === 'in' 
                      ? 'bg-green-500/20 text-green-400' 
                      : game.status === 'post' 
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/20 text-primary'
                  }`}>
                    {game.status_detail || game.status}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-8">
                  {/* Away Team */}
                  <div className="text-center flex-1">
                    {game.away_team_logo && (
                      <img 
                        src={game.away_team_logo} 
                        alt={game.away_team_name || ''}
                        className="w-20 h-20 mx-auto mb-2 object-contain"
                      />
                    )}
                    <p className="font-bold text-lg">{game.away_team_name}</p>
                    <p className="text-sm text-muted-foreground">{game.away_team_abbrev}</p>
                    {game.away_team_score !== null && (
                      <p className="text-3xl font-black mt-2">{game.away_team_score}</p>
                    )}
                  </div>

                  <div className="text-2xl font-bold text-muted-foreground">VS</div>

                  {/* Home Team */}
                  <div className="text-center flex-1">
                    {game.home_team_logo && (
                      <img 
                        src={game.home_team_logo} 
                        alt={game.home_team_name || ''}
                        className="w-20 h-20 mx-auto mb-2 object-contain"
                      />
                    )}
                    <p className="font-bold text-lg">{game.home_team_name}</p>
                    <p className="text-sm text-muted-foreground">{game.home_team_abbrev}</p>
                    {game.home_team_score !== null && (
                      <p className="text-3xl font-black mt-2">{game.home_team_score}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card className="bg-card/30 border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Top Performers
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleManualSync}
                    disabled={syncMutation.isPending}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                    {syncMutation.isPending ? 'Syncing...' : 'Refresh'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading || syncMutation.isPending ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : playerStats && playerStats.length > 0 ? (
                  <div className="space-y-3">
                    {playerStats.slice(0, 10).map((player, index) => (
                      <PlayerCard key={`${player.player_name}-${index}`} player={player} rank={index + 1} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No player stats available for this game yet.</p>
                    <p className="text-sm">Stats will appear after the game ends. Click Refresh to check for updates.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="bg-card/30 border-border/30">
            <CardContent className="p-8 text-center text-muted-foreground">
              <p>Game details not found.</p>
              <p className="text-sm mt-2">This game may not have been cached yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Matchup;