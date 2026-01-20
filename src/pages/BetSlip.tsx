import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, User, Receipt, ChevronDown, ChevronUp, Plus, X, Check, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBetSlip, AltLine, LegStats } from '@/contexts/BetSlipContext';
import { toast } from '@/hooks/use-toast';
import { fetchStatsForLegs } from '@/hooks/usePlayerStats';
import { useOdds } from '@/hooks/useOdds';

const STAT_TYPES = [
  { value: 'pts', label: 'Points (PTS)' },
  { value: 'reb', label: 'Rebounds (REB)' },
  { value: 'ast', label: 'Assists (AST)' },
  { value: '3pm', label: '3-Pointers Made (3PM)' },
  { value: 'pra', label: 'Pts + Reb + Ast (PRA)' },
  { value: 'pr', label: 'Pts + Reb (PR)' },
  { value: 'pa', label: 'Pts + Ast (PA)' },
  { value: 'ra', label: 'Reb + Ast (RA)' },
];

const ODDS_FORMATS = [
  { value: 'american', label: 'American' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'multiplier', label: 'Profit Multiplier' },
];

// Default lines by stat type
const DEFAULT_LINES: Record<string, number[]> = {
  pts: [5, 10, 15, 20, 25],
  reb: [3, 5, 7, 10, 13],
  ast: [3, 5, 7, 10, 13],
  '3pm': [1, 2, 3, 4, 5],
};

// Combo stat types that need over/under odds
const COMBO_STATS = ['pra', 'pr', 'pa', 'ra'];

const BetSlip = () => {
  const navigate = useNavigate();
  const { legs, removeLeg, duplicateLeg, updateLegDetails, clearSlip, setLegStats } = useBetSlip();
  const [expandedLegs, setExpandedLegs] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [fetchingOddsFor, setFetchingOddsFor] = useState<string | null>(null);
  const { fetchOddsForPlayer } = useOdds();

  const toggleExpand = (legId: string) => {
    setExpandedLegs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(legId)) {
        newSet.delete(legId);
      } else {
        newSet.add(legId);
      }
      return newSet;
    });
  };

  const saveLegDetails = useCallback((legId: string) => {
    setSaveStatus(prev => ({ ...prev, [legId]: 'saving' }));
    setTimeout(() => {
      setSaveStatus(prev => ({ ...prev, [legId]: 'saved' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [legId]: 'idle' }));
      }, 1500);
    }, 300);
  }, []);

  const generateDefaultLines = (statType: string): AltLine[] => {
    const isComboStat = COMBO_STATS.includes(statType);
    
    if (isComboStat) {
      // For combo stats, create 3 empty lines with over/under odds
      return [1, 2, 3].map(() => ({
        id: crypto.randomUUID(),
        line: '',
        odds: '',
        oddsOver: '',
        oddsUnder: '',
      }));
    }
    
    // For simple stats, use predefined defaults
    const defaultValues = DEFAULT_LINES[statType] || [5, 10, 15, 20, 25];
    return defaultValues.map(line => ({
      id: crypto.randomUUID(),
      line: line.toString(),
      odds: '',
    }));
  };

  const handleUpdateDetail = useCallback((legId: string, field: string, value: any) => {
    updateLegDetails(legId, { [field]: value });
    saveLegDetails(legId);
  }, [updateLegDetails, saveLegDetails]);

  const toggleAdvancedMode = (legId: string) => {
    const leg = legs.find(l => l.legId === legId);
    if (!leg) return;
    
    const current = leg.details;
    const newAdvancedMode = !current.advancedMode;
    
    if (newAdvancedMode && current.statType) {
      const defaultLines = generateDefaultLines(current.statType);
      updateLegDetails(legId, {
        advancedMode: true,
        altLines: defaultLines,
      });
      saveLegDetails(legId);
    } else {
      handleUpdateDetail(legId, 'advancedMode', newAdvancedMode);
    }
  };

  // Auto-fetch odds when stat type changes
  const autoFetchOddsForLeg = useCallback(async (legId: string, statType: string) => {
    const leg = legs.find(l => l.legId === legId);
    if (!leg) return;

    console.log(`🎯 autoFetchOddsForLeg STARTED for leg ${legId}, player: ${leg.player.name}, stat: ${statType}`);
    setFetchingOddsFor(legId);

    try {
      // Pass team name to help find the correct game
      const playerOdds = await fetchOddsForPlayer(leg.player.name, statType, leg.player.team);

      if (playerOdds) {
        console.log(`🎯 Found odds for ${leg.player.name}:`, playerOdds);
        updateLegDetails(legId, {
          mainLine: playerOdds.line.toString(),
          oddsOver: playerOdds.overOddsAmerican,
          oddsUnder: playerOdds.underOddsAmerican,
        });
        saveLegDetails(legId);
        
        toast({
          title: "Odds auto-populated",
          description: `${leg.player.name}: Line ${playerOdds.line} (O: ${playerOdds.overOddsAmerican} / U: ${playerOdds.underOddsAmerican})`,
        });
      } else {
        console.log(`🎯 No odds found for ${leg.player.name}`);
        toast({
          title: "Odds not found",
          description: `No odds available for ${leg.player.name} ${statType.toUpperCase()}. Enter manually.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error auto-fetching odds:', error);
      toast({
        title: "Error fetching odds",
        description: "Failed to fetch odds from API. Please enter manually.",
        variant: "destructive",
      });
    } finally {
      setFetchingOddsFor(null);
    }
  }, [legs, fetchOddsForPlayer, updateLegDetails, saveLegDetails]);

  const handleStatTypeChange = (legId: string, statType: string) => {
    const leg = legs.find(l => l.legId === legId);
    if (!leg) return;
    
    console.log(`🎯 Stat type change triggered for leg ${legId}: ${statType}`);
    
    if (leg.details.advancedMode) {
      const defaultLines = generateDefaultLines(statType);
      updateLegDetails(legId, {
        statType,
        altLines: defaultLines,
      });
      saveLegDetails(legId);
    } else {
      handleUpdateDetail(legId, 'statType', statType);
    }
    
    // Auto-fetch odds with statType passed directly (timing fix)
    autoFetchOddsForLeg(legId, statType);
  };

  const addAltLine = (legId: string) => {
    const leg = legs.find(l => l.legId === legId);
    if (!leg) return;
    
    const isComboStat = COMBO_STATS.includes(leg.details.statType);
    const maxLines = isComboStat ? 5 : 10;
    
    if (leg.details.altLines.length >= maxLines) {
      toast({
        title: "Maximum lines reached",
        description: `You can only add up to ${maxLines} lines.`,
        variant: "destructive",
      });
      return;
    }
    
    const newLine: AltLine = {
      id: crypto.randomUUID(),
      line: '',
      odds: '',
      ...(isComboStat && { oddsOver: '', oddsUnder: '' }),
    };
    
    updateLegDetails(legId, { altLines: [...leg.details.altLines, newLine] });
    saveLegDetails(legId);
  };

  const removeAltLine = (legId: string, lineId: string) => {
    const leg = legs.find(l => l.legId === legId);
    if (!leg) return;
    
    updateLegDetails(legId, {
      altLines: leg.details.altLines.filter(l => l.id !== lineId),
    });
    saveLegDetails(legId);
  };

  const updateAltLine = (legId: string, lineId: string, field: keyof AltLine, value: string) => {
    const leg = legs.find(l => l.legId === legId);
    if (!leg) return;
    
    const updatedLines = leg.details.altLines.map(l =>
      l.id === lineId ? { ...l, [field]: value } : l
    );
    updateLegDetails(legId, { altLines: updatedLines });
    saveLegDetails(legId);
  };

  const handleManualSave = (legId: string) => {
    saveLegDetails(legId);
    toast({
      title: "Saved",
      description: "Leg details saved successfully.",
    });
  };

  const handleDuplicateLeg = (legId: string) => {
    duplicateLeg(legId);
    toast({
      title: "Leg Duplicated",
      description: "A new leg has been created for the same player.",
    });
  };

  const handleContinue = async () => {
    // Validate that all legs have stat types
    const invalidLegs = legs.filter(leg => !leg.details.statType);
    if (invalidLegs.length > 0) {
      toast({
        title: "Missing stat types",
        description: "Please select a stat type for all legs before continuing.",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingStats(true);
    
    try {
      // Fetch stats for all legs
      toast({
        title: "Working my magic",
        description: `Crunching numbers for ${legs.length} player${legs.length !== 1 ? 's' : ''}...`,
      });

      const statsMap = await fetchStatsForLegs(legs);

      // Convert to the format expected by context
      const legStatsMap = new Map<string, LegStats>();
      statsMap.forEach((stats, legId) => {
        legStatsMap.set(legId, {
          legId: stats.legId,
          games: stats.games,
          statValues: stats.statValues,
          error: stats.error,
        });
      });

      setLegStats(legStatsMap);

      const successCount = Array.from(statsMap.values()).filter((s) => s.games.length > 0).length;
      const failedPlayers = legs
        .filter((leg) => {
          const stats = statsMap.get(leg.legId);
          return !stats || stats.games.length === 0;
        })
        .map((leg) => leg.player.name);

      // Hard gate: do not proceed unless EVERY leg has verified data
      if (successCount < legs.length) {
        toast({
          title: "Can't compute yet",
          description: `Missing verified data for: ${failedPlayers.slice(0, 4).join(', ')}${failedPlayers.length > 4 ? '…' : ''}. Please retry.`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "All set",
        description: "Stats are ready. Let’s compute.",
      });

      navigate('/decisions');
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "Error",
        description: "Couldn't load verified stats. Please try again.",
        variant: "destructive",
      });
      // Don't navigate on error
    } finally {
      setIsLoadingStats(false);
    }
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
              <Receipt className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight">BetSlip</h1>
              <p className="text-muted-foreground">
                {legs.length} leg{legs.length !== 1 ? 's' : ''} in slip
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
              <h2 className="text-xl font-semibold mb-2">Your BetSlip is empty</h2>
              <p className="text-muted-foreground mb-6">
                Add players from team rosters to build your bet slip
              </p>
              <Button onClick={() => navigate('/')}>
                Browse Teams
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Clear all button */}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearSlip}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>

            {/* Leg list */}
            <div className="space-y-3">
              {legs.map((leg, legIndex) => {
                const isExpanded = expandedLegs.has(leg.legId);
                const details = leg.details;
                const status = saveStatus[leg.legId] || 'idle';
                const isComboStat = COMBO_STATS.includes(details.statType);

                return (
                  <Card 
                    key={leg.legId} 
                    className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors overflow-hidden"
                  >
                    <CardContent className="p-4">
                      {/* Leg header row */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm flex-shrink-0">
                          {legIndex + 1}
                        </div>
                        
                        <div className="w-12 h-12 rounded-full bg-primary/20 overflow-hidden flex-shrink-0">
                          {leg.player.image ? (
                            <img 
                              src={leg.player.image} 
                              alt={leg.player.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center ${leg.player.image ? 'hidden' : ''}`}>
                            <User className="w-5 h-5 text-primary" />
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{leg.player.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {leg.player.team}
                            {details.statType && (
                              <span className="ml-2 text-primary">
                                • {STAT_TYPES.find(s => s.value === details.statType)?.label || details.statType}
                              </span>
                            )}
                          </p>
                        </div>

                        {status === 'saved' && (
                          <span className="text-xs text-green-500 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Saved
                          </span>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicateLeg(leg.legId)}
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 flex-shrink-0"
                          title="Duplicate leg for different stat"
                        >
                          <Copy className="w-5 h-5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleExpand(leg.legId)}
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 flex-shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLeg(leg.legId)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border/50 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Stat Type */}
                            <div className="space-y-2">
                              <Label htmlFor={`stat-${leg.legId}`}>Stat Type</Label>
                              <Select
                                value={details.statType}
                                onValueChange={(value) => handleStatTypeChange(leg.legId, value)}
                              >
                                <SelectTrigger id={`stat-${leg.legId}`} className="bg-background">
                                  <SelectValue placeholder="Select stat type" />
                                </SelectTrigger>
                                <SelectContent className="bg-background">
                                  {STAT_TYPES.map((stat) => (
                                    <SelectItem key={stat.value} value={stat.value}>
                                      {stat.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Main Line */}
                            <div className="space-y-2">
                              <Label htmlFor={`line-${leg.legId}`}>Main Line</Label>
                              <Input
                                id={`line-${leg.legId}`}
                                type="number"
                                step="0.5"
                                placeholder="e.g., 24.5"
                                value={details.mainLine}
                                onChange={(e) => handleUpdateDetail(leg.legId, 'mainLine', e.target.value)}
                                className="bg-background"
                              />
                            </div>

                            {/* Odds Format */}
                            <div className="space-y-2">
                              <Label htmlFor={`format-${leg.legId}`}>Odds Format</Label>
                              <Select
                                value={details.oddsFormat}
                                onValueChange={(value) => handleUpdateDetail(leg.legId, 'oddsFormat', value)}
                              >
                                <SelectTrigger id={`format-${leg.legId}`} className="bg-background">
                                  <SelectValue placeholder="Select format" />
                                </SelectTrigger>
                                <SelectContent className="bg-background">
                                  {ODDS_FORMATS.map((format) => (
                                    <SelectItem key={format.value} value={format.value}>
                                      {format.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Odds Over */}
                            <div className="space-y-2">
                              <Label htmlFor={`over-${leg.legId}`}>Odds Over</Label>
                              <Input
                                id={`over-${leg.legId}`}
                                type="text"
                                placeholder={details.oddsFormat === 'american' ? 'e.g., -110' : 'e.g., 1.91'}
                                value={details.oddsOver}
                                onChange={(e) => handleUpdateDetail(leg.legId, 'oddsOver', e.target.value)}
                                className="bg-background"
                              />
                            </div>

                            {/* Odds Under */}
                            <div className="space-y-2 sm:col-start-2">
                              <Label htmlFor={`under-${leg.legId}`}>Odds Under</Label>
                              <Input
                                id={`under-${leg.legId}`}
                                type="text"
                                placeholder={details.oddsFormat === 'american' ? 'e.g., -110' : 'e.g., 1.91'}
                                value={details.oddsUnder}
                                onChange={(e) => handleUpdateDetail(leg.legId, 'oddsUnder', e.target.value)}
                                className="bg-background"
                              />
                            </div>
                          </div>

                          {/* Advanced Mode - Alternate Lines */}
                          {details.advancedMode && details.statType && (
                            <div className="space-y-3 pt-2 border-t border-border/30">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">Alternate Lines</Label>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addAltLine(leg.legId)}
                                  className="h-7 text-xs"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add Line
                                </Button>
                              </div>
                              
                              {details.altLines.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No alternate lines. Click "Add Line" to add more.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {/* Header row */}
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                    <span className="w-6">#</span>
                                    <span className="flex-1">Line</span>
                                    {isComboStat ? (
                                      <>
                                        <span className="w-20">Over Odds</span>
                                        <span className="w-20">Under Odds</span>
                                      </>
                                    ) : (
                                      <span className="w-24">Odds</span>
                                    )}
                                    <span className="w-9"></span>
                                  </div>
                                  
                                  {details.altLines.map((altLine, index) => (
                                    <div key={altLine.id} className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground w-6">#{index + 1}</span>
                                      <Input
                                        type="number"
                                        step="0.5"
                                        placeholder="Line"
                                        value={altLine.line}
                                        onChange={(e) => updateAltLine(leg.legId, altLine.id, 'line', e.target.value)}
                                        className="bg-background h-9 flex-1"
                                      />
                                      {isComboStat ? (
                                        <>
                                          <Input
                                            type="text"
                                            placeholder="Over"
                                            value={altLine.oddsOver || ''}
                                            onChange={(e) => updateAltLine(leg.legId, altLine.id, 'oddsOver', e.target.value)}
                                            className="bg-background h-9 w-20"
                                          />
                                          <Input
                                            type="text"
                                            placeholder="Under"
                                            value={altLine.oddsUnder || ''}
                                            onChange={(e) => updateAltLine(leg.legId, altLine.id, 'oddsUnder', e.target.value)}
                                            className="bg-background h-9 w-20"
                                          />
                                        </>
                                      ) : (
                                        <Input
                                          type="text"
                                          placeholder="Odds"
                                          value={altLine.odds}
                                          onChange={(e) => updateAltLine(leg.legId, altLine.id, 'odds', e.target.value)}
                                          className="bg-background h-9 w-24"
                                        />
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeAltLine(leg.legId, altLine.id)}
                                        className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex gap-3 pt-2">
                            <Button
                              variant={details.advancedMode ? "default" : "outline"}
                              size="sm"
                              className="flex-1"
                              onClick={() => toggleAdvancedMode(leg.legId)}
                              disabled={!details.statType}
                            >
                              {details.advancedMode ? 'Basic Mode' : 'Advanced Mode'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleManualSave(leg.legId)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Save
                            </Button>
                          </div>
                          
                          {!details.statType && (
                            <p className="text-xs text-muted-foreground text-center">
                              Select a stat type to enable Advanced Mode
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Summary */}
            <Card className="bg-primary/10 border-primary/30 mt-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-semibold">Total Legs</span>
                  <span className="text-2xl font-bold text-primary">{legs.length}</span>
                </div>
                <Button 
                  className="w-full" 
                  size="lg" 
                  onClick={handleContinue}
                  disabled={isLoadingStats || legs.length === 0}
                >
                  {isLoadingStats ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading Stats...
                    </>
                  ) : (
                    'Continue with Selection'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
};

export default BetSlip;
