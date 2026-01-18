import { useScoreboard, ScoreboardGame } from '@/hooks/useNbaApi';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from 'lucide-react';

const TodayFixtures = () => {
  const { data: games, isLoading, error } = useScoreboard();

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-8">
        <div className="flex items-center gap-2 mb-4 justify-center">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Today's Games</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 px-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="min-w-[280px] h-24 rounded-lg flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !games || games.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-8">
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

  return (
    <div className="w-full max-w-4xl mx-auto mt-8">
      <div className="flex items-center gap-2 mb-4 justify-center">
        <Calendar className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Today's Games</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 px-2 snap-x snap-mandatory">
        {games.map((game: ScoreboardGame) => (
          <Card 
            key={game.id} 
            className="min-w-[280px] bg-card/50 border-border/30 hover:bg-card/80 transition-colors flex-shrink-0 snap-start"
          >
            <CardContent className="p-4">
              {/* Status */}
              <div className="text-xs text-center mb-3">
                <span className={`px-2 py-0.5 rounded-full ${
                  game.status === 'in' ? 'bg-green-500/20 text-green-400' :
                  game.status === 'post' ? 'bg-muted text-muted-foreground' :
                  'bg-primary/20 text-primary'
                }`}>
                  {game.statusDetail || game.time || 'Scheduled'}
                </span>
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
                  <p className="text-sm font-bold">{game.awayTeam.abbreviation}</p>
                  {game.awayTeam.score && (
                    <p className="text-xl font-black text-primary">{game.awayTeam.score}</p>
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
                  <p className="text-sm font-bold">{game.homeTeam.abbreviation}</p>
                  {game.homeTeam.score && (
                    <p className="text-xl font-black text-primary">{game.homeTeam.score}</p>
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