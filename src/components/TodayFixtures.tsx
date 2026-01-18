import { useSchedule, ScheduleGame } from '@/hooks/useNbaApi';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from 'lucide-react';

// Format time to Eastern Time from ISO string (e.g., "2025-01-23T00:30Z" -> "7:30 PM ET")
const formatGameTime = (dateString: string): string => {
  const date = new Date(dateString);
  
  // Format to Eastern Time using Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
  });
  
  return `${formatter.format(date)} ET`;
};

const TodayFixtures = () => {
  const { data: games, isLoading, error } = useSchedule();

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-8 px-4">
        <div className="flex items-center gap-2 mb-4 justify-center">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Today's Games</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !games || games.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-8 px-4">
        <div className="flex items-center gap-2 mb-4 justify-center">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Today's Games</h2>
        </div>
        <Card className="bg-card/30 border-border/30">
          <CardContent className="p-6 text-center text-muted-foreground">
            No games scheduled for today
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (game: ScheduleGame) => {
    if (game.status === 'in') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 animate-pulse">
          LIVE
        </span>
      );
    }
    if (game.status === 'post' || game.completed) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {game.statusDetail || 'Final'}
        </span>
      );
    }
    // Scheduled game - show UTC time
    return (
      <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary">
        {formatGameTime(game.date)}
      </span>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 px-4">
      <div className="flex items-center gap-2 mb-4 justify-center">
        <Calendar className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Today's Games</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((game: ScheduleGame) => (
          <Card 
            key={game.id} 
            className="bg-card/50 border-border/30 hover:bg-card/80 transition-colors"
          >
            <CardContent className="p-4">
              {/* Status */}
              <div className="text-xs text-center mb-3">
                {getStatusBadge(game)}
              </div>

              {/* Teams */}
              <div className="flex items-center justify-between gap-4">
                {/* Away Team */}
                <div className="flex-1 text-center">
                  {game.awayTeam.logo && (
                    <img 
                      src={game.awayTeam.logo} 
                      alt={game.awayTeam.name}
                      className="w-10 h-10 mx-auto mb-1 object-contain"
                    />
                  )}
                  <p className={`text-sm font-bold ${game.awayTeam.winner ? 'text-primary' : ''}`}>
                    {game.awayTeam.abbreviation}
                  </p>
                  {game.awayTeam.score !== undefined && (
                    <p className={`text-xl font-black ${game.awayTeam.winner ? 'text-primary' : 'text-foreground'}`}>
                      {game.awayTeam.score}
                    </p>
                  )}
                </div>

                {/* VS / @ */}
                <div className="text-muted-foreground text-sm font-medium">
                  {game.status === 'pre' ? '@' : 'vs'}
                </div>

                {/* Home Team */}
                <div className="flex-1 text-center">
                  {game.homeTeam.logo && (
                    <img 
                      src={game.homeTeam.logo} 
                      alt={game.homeTeam.name}
                      className="w-10 h-10 mx-auto mb-1 object-contain"
                    />
                  )}
                  <p className={`text-sm font-bold ${game.homeTeam.winner ? 'text-primary' : ''}`}>
                    {game.homeTeam.abbreviation}
                  </p>
                  {game.homeTeam.score !== undefined && (
                    <p className={`text-xl font-black ${game.homeTeam.winner ? 'text-primary' : 'text-foreground'}`}>
                      {game.homeTeam.score}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TodayFixtures;
