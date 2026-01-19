import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchedule, ScheduleGame } from '@/hooks/useNbaApi';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Get today's date string using local system date
// Returns YYYYMMDD format
const getTodayString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

// Parse YYYYMMDD string to Date object (for display purposes only)
const parseApiDate = (dateStr: string): Date => {
  const year = parseInt(dateStr.slice(0, 4));
  const month = parseInt(dateStr.slice(4, 6)) - 1;
  const day = parseInt(dateStr.slice(6, 8));
  return new Date(year, month, day);
};

// Format date for API (YYYYMMDD) from Date object using local time
const formatDateForApi = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

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
  const navigate = useNavigate();
  const todayString = getTodayString();
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayString);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const { data: games, isLoading, error, refetch } = useSchedule(selectedDateStr);

  const isToday = selectedDateStr === todayString;
  
  // For calendar display, parse the string to Date
  const selectedDate = parseApiDate(selectedDateStr);

  const goToPreviousDay = () => {
    const prev = subDays(selectedDate, 1);
    setSelectedDateStr(formatDateForApi(prev));
  };
  const goToNextDay = () => {
    const next = addDays(selectedDate, 1);
    setSelectedDateStr(formatDateForApi(next));
  };
  const goToToday = () => setSelectedDateStr(todayString);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDateStr(formatDateForApi(date));
      setCalendarOpen(false);
    }
  };

  const getDateLabel = () => {
    if (isToday) return "Today's Games";
    return format(selectedDate, 'EEEE, MMM d');
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-completed-games', {
        body: { days: 3 },
      });

      if (error) {
        toast.error('Sync failed', { description: error.message });
      } else {
        toast.success('Database synced', {
          description: `Updated ${data?.gamesUpdated || 0} games with ${data?.playerStatsAdded || 0} player stats`,
        });
        refetch();
      }
    } catch (err) {
      toast.error('Sync failed', { description: 'Could not reach sync service' });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto mt-8 px-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Button variant="ghost" size="icon" disabled>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">{getDateLabel()}</h2>
          </div>
          <Button variant="ghost" size="icon" disabled>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
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
    <div className="w-full max-w-4xl mx-auto mt-6 sm:mt-8 px-0 sm:px-4">
      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 mb-4 flex-wrap">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={goToPreviousDay}
          className="hover:bg-muted h-8 w-8 sm:h-10 sm:w-10"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "flex items-center gap-1 sm:gap-2 hover:bg-muted px-2 sm:px-4",
                !isToday && "text-primary"
              )}
            >
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <h2 className="text-sm sm:text-lg font-semibold">{getDateLabel()}</h2>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={goToNextDay}
          className="hover:bg-muted h-8 w-8 sm:h-10 sm:w-10"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>

        {/* Sync Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="hover:bg-muted ml-1 sm:ml-2 h-8 w-8 sm:h-10 sm:w-10"
          title="Sync database with latest game data"
        >
          <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
        </Button>
      </div>

      {/* Today Button */}
      {!isToday && (
        <div className="flex justify-center mb-4">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Back to Today
          </Button>
        </div>
      )}

      {/* Games Grid */}
      {error || !games || games.length === 0 ? (
        <Card className="bg-card/30 border-border/30">
          <CardContent className="p-6 text-center text-muted-foreground">
            No games scheduled for {isToday ? 'today' : format(selectedDate, 'MMM d')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {games.map((game: ScheduleGame) => (
            <Card 
              key={game.id} 
              className="bg-card/50 border-border/30 hover:bg-card/80 transition-colors cursor-pointer"
              onClick={() => navigate(`/matchup/${game.id}`)}
            >
              <CardContent className="p-2 sm:p-4">
                {/* Status */}
                <div className="text-xs text-center mb-2 sm:mb-3">
                  {getStatusBadge(game)}
                </div>

                {/* Teams */}
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  {/* Away Team */}
                  <div className="flex-1 text-center min-w-0">
                    {game.awayTeam.logo && (
                      <img 
                        src={game.awayTeam.logo} 
                        alt={game.awayTeam.name}
                        className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 object-contain"
                      />
                    )}
                    <p className={`text-xs sm:text-sm font-bold truncate ${game.awayTeam.winner ? 'text-primary' : ''}`}>
                      {game.awayTeam.abbreviation}
                    </p>
                    {/* Only show score if game has started (in progress or completed) */}
                    {game.status !== 'pre' && game.awayTeam.score !== undefined && (
                      <p className={`text-lg sm:text-xl font-black ${game.awayTeam.winner ? 'text-primary' : 'text-foreground'}`}>
                        {game.awayTeam.score}
                      </p>
                    )}
                  </div>

                  {/* VS / @ */}
                  <div className="text-muted-foreground text-sm font-medium">
                    {game.status === 'pre' ? '@' : 'vs'}
                  </div>

                  {/* Home Team */}
                  <div className="flex-1 text-center min-w-0">
                    {game.homeTeam.logo && (
                      <img 
                        src={game.homeTeam.logo} 
                        alt={game.homeTeam.name}
                        className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-1 object-contain"
                      />
                    )}
                    <p className={`text-xs sm:text-sm font-bold truncate ${game.homeTeam.winner ? 'text-primary' : ''}`}>
                      {game.homeTeam.abbreviation}
                    </p>
                    {/* Only show score if game has started (in progress or completed) */}
                    {game.status !== 'pre' && game.homeTeam.score !== undefined && (
                      <p className={`text-lg sm:text-xl font-black ${game.homeTeam.winner ? 'text-primary' : 'text-foreground'}`}>
                        {game.homeTeam.score}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TodayFixtures;
