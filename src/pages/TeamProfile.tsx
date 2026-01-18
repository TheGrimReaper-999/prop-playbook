import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlayerList, useTeamInfoByName, RapidApiPlayer } from '@/hooks/useNbaApi';

const TeamProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch team from database
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['team', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_teams')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch real team info from API (conference, division, logo)
  const { data: apiTeamInfo, isLoading: apiTeamLoading } = useTeamInfoByName(team?.name || null);

  // Fetch roster from RapidAPI using team_id
  const { data: apiRoster, isLoading: rosterLoading } = usePlayerList(team?.team_id || null);

  if (teamLoading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-10 w-32 mb-8" />
          <div className="flex gap-8 items-start">
            <Skeleton className="w-48 h-48 rounded-lg" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-12 w-64" />
              <Skeleton className="h-6 w-48" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Team Not Found</h1>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </main>
    );
  }

  // Use API logo if available, otherwise fall back to DB logo
  const teamLogo = apiTeamInfo?.teamLogo || team.logo_url;
  const conference = apiTeamInfo?.conference || 'NBA';
  const division = apiTeamInfo?.division || 'Division';

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

          {/* Team Header */}
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            <div className="w-40 h-40 rounded-xl bg-white/10 p-4 flex items-center justify-center">
              {teamLogo ? (
                <img 
                  src={teamLogo} 
                  alt={team.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-4xl font-bold text-primary">
                  {team.name.split(' ').slice(-1)[0]?.[0] || 'T'}
                </div>
              )}
            </div>
            
            <div className="text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">
                {team.name}
              </h1>
              {apiTeamInfo?.teamCity && (
                <p className="text-lg text-muted-foreground mb-2">
                  {apiTeamInfo.teamCity}
                </p>
              )}
              <p className="text-xl text-muted-foreground mb-4">
                {apiRoster?.length || 0} Players on Roster
              </p>
              <div className="flex gap-2 justify-center md:justify-start flex-wrap">
                <span className="px-3 py-1 bg-primary/20 rounded-full text-sm font-medium text-primary">
                  {conference} Conference
                </span>
                <span className="px-3 py-1 bg-secondary rounded-full text-sm font-medium">
                  {division} Division
                </span>
                {apiTeamInfo?.teamAbbr && (
                  <span className="px-3 py-1 bg-muted rounded-full text-sm font-medium">
                    {apiTeamInfo.teamAbbr}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Roster */}
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6">Team Roster</h2>
        
        {rosterLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : apiRoster && apiRoster.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apiRoster.map((player: RapidApiPlayer) => (
              <Card 
                key={player.playerId} 
                className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors cursor-pointer group"
                onClick={() => navigate(`/player/api/${player.playerId}`)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/20 overflow-hidden flex-shrink-0">
                    {player.headShotUrl ? (
                      <img 
                        src={player.headShotUrl} 
                        alt={player.playerName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                      {player.playerName}
                    </h3>
                    <div className="flex gap-2 text-sm text-muted-foreground">
                      <span>{player.pos}</span>
                      {player.height && <span>• {player.height}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No players found for this team.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
};

export default TeamProfile;
