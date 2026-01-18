import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, MinusCircle, Receipt, Check, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useBetSlip, BetSlipLeg, ParlayLeg } from '@/contexts/BetSlipContext';
import { evaluateProp, BetDecisionResult } from '@/lib/betting-utils';
import { toast } from '@/hooks/use-toast';

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

interface DecisionCardProps {
  leg: BetSlipLeg;
  result: BetDecisionResult;
  legNumber: number;
  isSelected: boolean;
  onToggleSelect: (legId: string) => void;
}

const DecisionCard = ({ leg, result, legNumber, isSelected, onToggleSelect }: DecisionCardProps) => {
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

  const getDecisionBgColor = (decision: string, selected: boolean) => {
    const base = selected ? 'ring-2 ring-primary ' : '';
    switch (decision) {
      case 'TAKE OVER':
        return base + 'bg-green-500/10 border-green-500/30';
      case 'TAKE UNDER':
        return base + 'bg-red-500/10 border-red-500/30';
      default:
        return base + 'bg-muted/30 border-muted/50';
    }
  };

  const getDecisionIcon = (decision: string) => {
    switch (decision) {
      case 'TAKE OVER':
        return <TrendingUp className="w-8 h-8 text-green-500" />;
      case 'TAKE UNDER':
        return <TrendingDown className="w-8 h-8 text-red-500" />;
      default:
        return <MinusCircle className="w-8 h-8 text-muted-foreground" />;
    }
  };

  const statLabel = STAT_TYPE_LABELS[leg.details.statType] || leg.details.statType || 'Not Set';
  const mainLine = leg.details.mainLine || '-';

  return (
    <Card 
      className={`${getDecisionBgColor(result.decision, isSelected)} transition-all cursor-pointer`}
      onClick={() => onToggleSelect(leg.legId)}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <div className="flex-shrink-0 pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(leg.legId)}
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-5"
            />
          </div>

          {/* Decision Icon */}
          <div className="flex-shrink-0 w-14 h-14 rounded-full bg-background/50 flex items-center justify-center">
            {getDecisionIcon(result.decision)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground font-medium">Leg #{legNumber}</span>
              {isSelected && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Selected
                </span>
              )}
            </div>
            
            <h3 className="font-bold text-lg truncate">{leg.player.name}</h3>
            <p className="text-sm text-muted-foreground">{leg.player.team}</p>
            
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="bg-background/50 rounded-lg px-3 py-1.5">
                <span className="text-xs text-muted-foreground block">Stat</span>
                <span className="font-semibold text-sm">{statLabel}</span>
              </div>
              <div className="bg-background/50 rounded-lg px-3 py-1.5">
                <span className="text-xs text-muted-foreground block">Line</span>
                <span className="font-semibold text-sm">{mainLine}</span>
              </div>
              <div className="bg-background/50 rounded-lg px-3 py-1.5">
                <span className="text-xs text-muted-foreground block">Confidence</span>
                <span className="font-semibold text-sm">{result.confidence.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Decision */}
          <div className="flex-shrink-0 text-right">
            <span className={`text-2xl font-black ${getDecisionColor(result.decision)}`}>
              {result.decision}
            </span>
            
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-end gap-2">
                <span className="text-muted-foreground">EV Over:</span>
                <span className={result.evOver > 0 ? 'text-green-500' : 'text-red-500'}>
                  {(result.evOver * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-end gap-2">
                <span className="text-muted-foreground">EV Under:</span>
                <span className={result.evUnder > 0 ? 'text-green-500' : 'text-red-500'}>
                  {(result.evUnder * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Probability Details */}
        <div className="mt-4 pt-4 border-t border-border/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs">
            <div>
              <span className="text-muted-foreground block">Model Over</span>
              <span className="font-semibold">{(result.pOverModel * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Model Under</span>
              <span className="font-semibold">{(result.pUnderModel * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Fair Over</span>
              <span className="font-semibold">{(result.pOverFair * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Fair Under</span>
              <span className="font-semibold">{(result.pUnderFair * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Decisions = () => {
  const navigate = useNavigate();
  const { legs, saveParlay } = useBetSlip();
  const [selectedLegs, setSelectedLegs] = useState<Set<string>>(new Set());

  const decisions = useMemo(() => {
    return legs.map((leg) => {
      const propLine = parseFloat(leg.details.mainLine) || 0;
      const overOdds = parseFloat(leg.details.oddsOver) || 0;
      const underOdds = parseFloat(leg.details.oddsUnder) || 0;

      const result = evaluateProp({
        propLine,
        overOdds,
        underOdds,
        oddsFormat: leg.details.oddsFormat,
      });

      return { leg, result };
    });
  }, [legs]);

  const summary = useMemo(() => {
    const takeOver = decisions.filter((d) => d.result.decision === 'TAKE OVER').length;
    const takeUnder = decisions.filter((d) => d.result.decision === 'TAKE UNDER').length;
    const noBet = decisions.filter((d) => d.result.decision === 'NO BET').length;
    return { takeOver, takeUnder, noBet };
  }, [decisions]);

  const toggleSelectLeg = (legId: string) => {
    setSelectedLegs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(legId)) {
        newSet.delete(legId);
      } else {
        newSet.add(legId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = new Set(legs.map((leg) => leg.legId));
    setSelectedLegs(allIds);
  };

  const deselectAll = () => {
    setSelectedLegs(new Set());
  };

  const selectRecommended = () => {
    const recommended = decisions
      .filter((d) => d.result.decision !== 'NO BET')
      .map((d) => d.leg.legId);
    setSelectedLegs(new Set(recommended));
  };

  const handleAddToParlay = () => {
    if (selectedLegs.size === 0) {
      toast({
        title: "No legs selected",
        description: "Please select at least one leg to add to parlay.",
        variant: "destructive",
      });
      return;
    }

    const selectedDecisions = decisions.filter((d) => selectedLegs.has(d.leg.legId));
    const parlayLegs: ParlayLeg[] = selectedDecisions.map((d) => ({
      legId: d.leg.legId,
      player: d.leg.player,
      statType: d.leg.details.statType,
      mainLine: d.leg.details.mainLine,
      decision: d.result.decision,
      oddsFormat: d.leg.details.oddsFormat,
      oddsOver: d.leg.details.oddsOver,
      oddsUnder: d.leg.details.oddsUnder,
    }));

    // Save the parlay
    saveParlay(parlayLegs);

    toast({
      title: "Parlay Saved!",
      description: `${selectedLegs.size} leg${selectedLegs.size !== 1 ? 's' : ''} saved to your parlays.`,
    });

    // Navigate to parlays page
    navigate('/parlays');
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/20 to-background p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/betslip')}
            className="mb-6 hover:bg-primary/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to BetSlip
          </Button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center">
              <Receipt className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight">Decisions</h1>
              <p className="text-muted-foreground">
                {legs.length} leg{legs.length !== 1 ? 's' : ''} analyzed
                {selectedLegs.size > 0 && (
                  <span className="ml-2 text-primary font-medium">
                    • {selectedLegs.size} selected
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        {legs.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <Receipt className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No legs to analyze</h2>
              <p className="text-muted-foreground mb-6">
                Add players and configure their props in the BetSlip first
              </p>
              <Button onClick={() => navigate('/betslip')}>Go to BetSlip</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Summary */}
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4">Summary</h2>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-green-500/10 rounded-lg p-4">
                    <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
                    <span className="text-2xl font-bold text-green-500">{summary.takeOver}</span>
                    <span className="text-xs text-muted-foreground block">Take Over</span>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-4">
                    <TrendingDown className="w-6 h-6 text-red-500 mx-auto mb-2" />
                    <span className="text-2xl font-bold text-red-500">{summary.takeUnder}</span>
                    <span className="text-xs text-muted-foreground block">Take Under</span>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <MinusCircle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <span className="text-2xl font-bold">{summary.noBet}</span>
                    <span className="text-xs text-muted-foreground block">No Bet</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selection Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">Quick select:</span>
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
              <Button variant="outline" size="sm" onClick={selectRecommended}>
                Select Recommended
              </Button>
            </div>

            {/* Decision Cards */}
            <div className="space-y-4">
              {decisions.map(({ leg, result }, index) => (
                <DecisionCard
                  key={leg.legId}
                  leg={leg}
                  result={result}
                  legNumber={index + 1}
                  isSelected={selectedLegs.has(leg.legId)}
                  onToggleSelect={toggleSelectLeg}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="flex-1"
                    onClick={() => navigate('/betslip')}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to BetSlip
                  </Button>
                  <Button 
                    size="lg" 
                    className="flex-1"
                    onClick={handleAddToParlay}
                    disabled={selectedLegs.size === 0}
                  >
                    <Layers className="w-4 h-4 mr-2" />
                    Add to Parlay ({selectedLegs.size})
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
};

export default Decisions;
