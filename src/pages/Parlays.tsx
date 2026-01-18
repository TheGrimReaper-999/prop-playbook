import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, TrendingUp, TrendingDown, MinusCircle, Layers, Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBetSlip, SavedParlay, ParlayLeg } from '@/contexts/BetSlipContext';
import { toast } from '@/hooks/use-toast';
import { useParlayStatus, ParlayStatus, LegStatus } from '@/hooks/useParlayStatus';
const STAT_TYPE_LABELS: Record<string, string> = {
  pts: 'Points',
  reb: 'Rebounds',
  ast: 'Assists',
  '3pm': '3-Pointers Made',
  pra: 'Pts + Reb + Ast',
  pr: 'Pts + Reb',
  pa: 'Pts + Ast',
  ra: 'Reb + Ast',
};

const getDecisionIcon = (decision: string) => {
  switch (decision) {
    case 'TAKE OVER':
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    case 'TAKE UNDER':
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    default:
      return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
  }
};

const getDecisionColor = (decision: string) => {
  switch (decision) {
    case 'TAKE OVER':
      return 'text-green-500';
    case 'TAKE UNDER':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
};

const getStatusBadge = (status: ParlayStatus) => {
  switch (status) {
    case 'win':
      return (
        <span className="flex items-center gap-1.5 bg-green-500/20 text-green-500 px-3 py-1 rounded-full text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          WIN
        </span>
      );
    case 'loss':
      return (
        <span className="flex items-center gap-1.5 bg-red-500/20 text-red-500 px-3 py-1 rounded-full text-sm font-semibold">
          <XCircle className="w-4 h-4" />
          LOSS
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1.5 bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full text-sm font-semibold">
          <Clock className="w-4 h-4" />
          PENDING
        </span>
      );
  }
};

const getLegStatusIcon = (status: LegStatus) => {
  switch (status) {
    case 'win':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'loss':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-yellow-500" />;
  }
};

interface ParlayCardProps {
  parlay: SavedParlay;
  onDelete: (id: string) => void;
  status?: ParlayStatus;
  legStatuses?: Map<string, LegStatus>;
}

const ParlayCard = ({ parlay, onDelete, status = 'pending', legStatuses }: ParlayCardProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = () => {
    onDelete(parlay.id);
    toast({
      title: "Parlay deleted",
      description: "The parlay has been removed from your saved bets.",
    });
  };

  return (
    <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg">{parlay.name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              {formatDate(parlay.createdAt)}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-semibold">
              {parlay.legs.length} Leg{parlay.legs.length !== 1 ? 's' : ''}
            </span>
            {getStatusBadge(status)}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Legs */}
        <div className="space-y-2">
          {parlay.legs.map((leg, index) => {
            const legStatus = legStatuses?.get(leg.legId);
            return (
              <div
                key={leg.legId}
                className="flex items-center gap-3 p-3 bg-background/50 rounded-lg"
              >
                <span className="text-xs text-muted-foreground font-medium w-6">
                  #{index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{leg.player.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {STAT_TYPE_LABELS[leg.statType] || leg.statType} • {leg.mainLine}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getDecisionIcon(leg.decision)}
                  <span className={`text-sm font-semibold ${getDecisionColor(leg.decision)}`}>
                    {leg.decision}
                  </span>
                  {legStatus && getLegStatusIcon(legStatus)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const Parlays = () => {
  const navigate = useNavigate();
  const { parlays, deleteParlay, clearParlays } = useBetSlip();
  const { data: parlayStatuses } = useParlayStatus(parlays);

  const handleClearAll = () => {
    if (parlays.length === 0) return;
    clearParlays();
    toast({
      title: "All parlays cleared",
      description: "Your saved bets have been removed.",
    });
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/20 to-background p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-6 hover:bg-primary/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center">
              <Layers className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight">Saved Bets</h1>
              <p className="text-muted-foreground">
                {parlays.length} parlay{parlays.length !== 1 ? 's' : ''} saved
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        {parlays.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <Layers className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No saved parlays</h2>
              <p className="text-muted-foreground mb-6">
                Add legs to your BetSlip and save them as parlays from the Decisions page
              </p>
              <Button onClick={() => navigate('/betslip')}>Go to BetSlip</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Clear all button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>

            {/* Parlay Cards */}
            <div className="space-y-4">
              {parlays.map((parlay) => {
                const result = parlayStatuses?.get(parlay.id);
                const legStatusMap = new Map<string, LegStatus>();
                result?.legResults.forEach(lr => legStatusMap.set(lr.legId, lr.status));
                
                return (
                  <ParlayCard 
                    key={parlay.id} 
                    parlay={parlay} 
                    onDelete={deleteParlay}
                    status={result?.status}
                    legStatuses={legStatusMap}
                  />
                );
              })}
            </div>

            {/* Action Button */}
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-6">
                <Button className="w-full" size="lg" onClick={() => navigate('/betslip')}>
                  Create New BetSlip
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
};

export default Parlays;
