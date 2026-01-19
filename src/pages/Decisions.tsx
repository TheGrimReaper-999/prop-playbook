import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, MinusCircle, Receipt, Check, Layers, ChevronDown, ChevronUp, BarChart3, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useBetSlip, BetSlipLeg, ParlayLeg, LegStats } from '@/contexts/BetSlipContext';
import { evaluateProp, BetDecisionResult } from '@/lib/betting-utils';
import { toast } from '@/hooks/use-toast';
import { getStatValuesForType, fetchStatsForLegs } from '@/hooks/usePlayerStats';
import StatsChart from '@/components/StatsChart';

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
  stats?: LegStats;
  isExpanded: boolean;
  onToggleExpand: (legId: string) => void;
}

const DecisionCard = ({ 
  leg, 
  result, 
  legNumber, 
  isSelected, 
  onToggleSelect,
  stats,
  isExpanded,
  onToggleExpand,
}: DecisionCardProps) => {
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
  const hasStats = stats && stats.games.length > 0;
  const hasNoData = !stats || stats.games.length === 0;

  return (
    <Card className={`${getDecisionBgColor(result.decision, isSelected)} transition-all`}>
      <CardContent className="p-6">
        <div 
          className="flex items-start gap-4 cursor-pointer"
          onClick={() => onToggleSelect(leg.legId)}
        >
          {/* Checkbox */}
          <div className="flex-shrink-0 pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(leg.legId)}
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-5"
              disabled={hasNoData}
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
              {hasStats && (
                <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">
                  {stats.games.length} games
                </span>
              )}
              {hasNoData && (
                <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  No data
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
                <span className="font-semibold text-sm">{result.confidence}</span>
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

        {/* Expand Button */}
        {hasStats && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(leg.legId);
              }}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              {isExpanded ? 'Hide' : 'Show'} Game Log Chart
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 ml-2" />
              ) : (
                <ChevronDown className="w-4 h-4 ml-2" />
              )}
            </Button>
          </div>
        )}

        {/* Expanded Chart */}
        {isExpanded && hasStats && (
          <div className="mt-4" onClick={(e) => e.stopPropagation()}>
            <StatsChart
              games={stats.games}
              statType={leg.details.statType}
              mainLine={parseFloat(leg.details.mainLine) || undefined}
              playerName={leg.player.name}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Decisions = () => {
  const navigate = useNavigate();
  const { legs, legStats, setLegStats, saveParlay } = useBetSlip();
  const [selectedLegs, setSelectedLegs] = useState<Set<string>>(new Set());
  const [expandedLegs, setExpandedLegs] = useState<Set<string>>(new Set());
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsLoadAttempted, setStatsLoadAttempted] = useState(false);

  // Check if we need to load stats (self-sufficient behavior)
  const missingStats = useMemo(() => {
    return legs.filter(leg => {
      const stats = legStats.get(leg.legId);
      return !stats || stats.games.length === 0;
    });
  }, [legs, legStats]);

  // Auto-fetch stats if missing when page loads
  useEffect(() => {
    if (legs.length === 0 || statsLoadAttempted) return;
    
    if (missingStats.length > 0) {
      const loadStats = async () => {
        setIsLoadingStats(true);
        setStatsLoadAttempted(true);
        
        try {
          console.log(`[Decisions] Loading stats for ${legs.length} legs...`);
          const statsMap = await fetchStatsForLegs(legs);
          
          // Merge with existing stats
          const mergedStats = new Map(legStats);
          statsMap.forEach((value, key) => {
            mergedStats.set(key, value);
          });
          
          setLegStats(mergedStats);
          
          const successCount = Array.from(statsMap.values()).filter(s => s.games.length > 0).length;
          console.log(`[Decisions] Loaded stats: ${successCount}/${legs.length} players have data`);
          
          if (successCount < legs.length) {
            toast({
              title: "Partial stats loaded",
              description: `Loaded verified stats for ${successCount} of ${legs.length} players.`,
            });
          }
        } catch (error) {
          console.error('[Decisions] Error loading stats:', error);
          toast({
            title: "Error loading stats",
            description: "Some player stats could not be loaded.",
            variant: "destructive",
          });
        } finally {
          setIsLoadingStats(false);
        }
      };
      
      loadStats();
    } else {
      setStatsLoadAttempted(true);
    }
  }, [legs, legStats, missingStats, statsLoadAttempted, setLegStats]);

  const decisions = useMemo(() => {
    return legs.map((leg) => {
      const propLine = parseFloat(leg.details.mainLine) || 0;
      const overOdds = parseFloat(leg.details.oddsOver) || 0;
      const underOdds = parseFloat(leg.details.oddsUnder) || 0;

      // Get real stats if available
      const stats = legStats.get(leg.legId);
      let last10Stats: number[] | undefined;
      
      if (stats && stats.games.length > 0) {
        last10Stats = getStatValuesForType(stats.statValues, leg.details.statType, 10);
      }

      const result = evaluateProp({
        propLine,
        overOdds,
        underOdds,
        oddsFormat: leg.details.oddsFormat as 'american' | 'decimal' | 'multiplier',
        last10Stats,
      });

      return { leg, result, stats };
    });
  }, [legs, legStats]);

  const summary = useMemo(() => {
    const takeOver = decisions.filter((d) => d.result.decision === 'TAKE OVER').length;
    const takeUnder = decisions.filter((d) => d.result.decision === 'TAKE UNDER').length;
    const noBet = decisions.filter((d) => d.result.decision === 'NO BET').length;
    const withData = decisions.filter((d) => d.stats && d.stats.games.length > 0).length;
    return { takeOver, takeUnder, noBet, withData };
  }, [decisions]);

  const toggleSelectLeg = (legId: string) => {
    // Only allow selection if leg has stats
    const stats = legStats.get(legId);
    if (!stats || stats.games.length === 0) return;
    
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

  const toggleExpandLeg = (legId: string) => {
    setExpandedLegs((prev) => {
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
    // Only select legs with verified stats
    const validIds = decisions
      .filter((d) => d.stats && d.stats.games.length > 0)
      .map((d) => d.leg.legId);
    setSelectedLegs(new Set(validIds));
  };

  const deselectAll = () => {
    setSelectedLegs(new Set());
  };

  const selectRecommended = () => {
    // Only select recommended legs that have verified stats
    const recommended = decisions
      .filter((d) => d.result.decision !== 'NO BET' && d.stats && d.stats.games.length > 0)
      .map((d) => d.leg.legId);
    setSelectedLegs(new Set(recommended));
  };

  const [showNamingDialog, setShowNamingDialog] = useState(false);
  const [parlayName, setParlayName] = useState('');
  const [pendingParlayLegs, setPendingParlayLegs] = useState<ParlayLeg[]>([]);

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

    // Store legs and show naming dialog
    setPendingParlayLegs(parlayLegs);
    setParlayName(`Parlay ${new Date().toLocaleDateString()}`);
    setShowNamingDialog(true);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleConfirmSaveParlay = async () => {
    if (pendingParlayLegs.length === 0) return;

    setIsSaving(true);
    try {
      // Save the parlay with the custom name
      await saveParlay(pendingParlayLegs, parlayName.trim() || undefined);

      toast({
        title: "Parlay Saved!",
        description: `${pendingParlayLegs.length} leg${pendingParlayLegs.length !== 1 ? 's' : ''} saved to your parlays.`,
      });

      // Reset and close dialog
      setShowNamingDialog(false);
      setParlayName('');
      setPendingParlayLegs([]);

      // Navigate to parlays page
      navigate('/parlays');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save parlay. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading state if we're fetching stats
  if (isLoadingStats) {
    return (
      <main className="min-h-screen bg-background">
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
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto p-6">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 mx-auto mb-4 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Loading Verified Stats</h2>
              <p className="text-muted-foreground">
                Fetching real game data for {legs.length} player{legs.length !== 1 ? 's' : ''}...
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

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
                {summary.withData < legs.length && (
                  <span className="ml-2 text-yellow-500">
                    • {summary.withData} with verified data
                  </span>
                )}
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
              {decisions.map(({ leg, result, stats }, index) => (
                <DecisionCard
                  key={leg.legId}
                  leg={leg}
                  result={result}
                  legNumber={index + 1}
                  isSelected={selectedLegs.has(leg.legId)}
                  onToggleSelect={toggleSelectLeg}
                  stats={stats}
                  isExpanded={expandedLegs.has(leg.legId)}
                  onToggleExpand={toggleExpandLeg}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Layers className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-semibold">
                        {selectedLegs.size} leg{selectedLegs.size !== 1 ? 's' : ''} selected
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Ready to save as parlay
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleAddToParlay}
                    disabled={selectedLegs.size === 0}
                    className="w-full sm:w-auto"
                  >
                    Save to Parlays
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Naming Dialog */}
      <Dialog open={showNamingDialog} onOpenChange={setShowNamingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name Your Parlay</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="parlay-name" className="text-sm font-medium">
                Parlay Name
              </label>
              <Input
                id="parlay-name"
                value={parlayName}
                onChange={(e) => setParlayName(e.target.value)}
                placeholder="Enter a name for your parlay"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {pendingParlayLegs.length} leg{pendingParlayLegs.length !== 1 ? 's' : ''} will be saved
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNamingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSaveParlay} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Parlay'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Decisions;
