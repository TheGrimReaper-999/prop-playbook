import { useState } from 'react';
import { useSchedule, ScheduleGame } from '@/hooks/useNbaApi';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

// Get today's date in Eastern Time (NBA uses ET for scheduling)
const getTodayInET = (): Date => {
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  // Parse the ET date string back to a Date object
  const [year, month, day] = etFormatter.format(now).split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Format date for API (YYYYMMDD)
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
  const todayET = getTodayInET();
  const [selectedDate, setSelectedDate] = useState<Date>(todayET);
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const dateForApi = formatDateForApi(selectedDate);
  const { data: games, isLoading, error } = useSchedule(dateForApi);

  const isToday = formatDateForApi(selectedDate) === formatDateForApi(todayET);

  const goToPreviousDay = () => setSelectedDate(prev => subDays(prev, 1));
  const goToNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const goToToday = () => setSelectedDate(todayET);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setCalendarOpen(false);
    }
  };

  const getDateLabel = () => {
    if (isToday) return "Today's Games";
    return format(selectedDate, 'EEEE, MMM d');
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
    <div className="w-full max-w-4xl mx-auto mt-8 px-4">
      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={goToPreviousDay}
          className="hover:bg-muted"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "flex items-center gap-2 hover:bg-muted",
                !isToday && "text-primary"
              )}
            >
              <CalendarIcon className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">{getDateLabel()}</h2>
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
          className="hover:bg-muted"
        >
          <ChevronRight className="w-4 h-4" />
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
                    {/* Only show score if game has started (in progress or completed) */}
                    {game.status !== 'pre' && game.awayTeam.score !== undefined && (
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
                    {/* Only show score if game has started (in progress or completed) */}
                    {game.status !== 'pre' && game.homeTeam.score !== undefined && (
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
      )}
    </div>
  );
};

export default TodayFixtures;
