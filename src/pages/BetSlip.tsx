import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, User, Receipt, ChevronDown, ChevronUp, Plus, X, Check } from 'lucide-react';
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
import { useBetSlip } from '@/contexts/BetSlipContext';
import { toast } from '@/hooks/use-toast';

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

interface AltLine {
  id: string;
  line: string;
  odds: string;
}

interface PlayerBetDetails {
  statType: string;
  mainLine: string;
  oddsFormat: string;
  oddsOver: string;
  oddsUnder: string;
  advancedMode: boolean;
  altLines: AltLine[];
}

const BetSlip = () => {
  const navigate = useNavigate();
  const { players, removePlayer, clearSlip } = useBetSlip();
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());
  const [betDetails, setBetDetails] = useState<Record<string, PlayerBetDetails>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});

  const toggleExpand = (playerId: string) => {
    setExpandedPlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const savePlayerDetails = useCallback((playerId: string) => {
    setSaveStatus(prev => ({ ...prev, [playerId]: 'saving' }));
    // Simulate save - in real app this would save to database
    setTimeout(() => {
      setSaveStatus(prev => ({ ...prev, [playerId]: 'saved' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [playerId]: 'idle' }));
      }, 1500);
    }, 300);
  }, []);

  const updateBetDetail = useCallback((playerId: string, field: keyof PlayerBetDetails, value: any) => {
    setBetDetails(prev => ({
      ...prev,
      [playerId]: {
        ...getPlayerBetDetailsFromState(prev, playerId),
        [field]: value,
      },
    }));
    // Auto-save on change
    savePlayerDetails(playerId);
  }, [savePlayerDetails]);

  const getPlayerBetDetailsFromState = (state: Record<string, PlayerBetDetails>, playerId: string): PlayerBetDetails => {
    return state[playerId] || {
      statType: '',
      mainLine: '',
      oddsFormat: 'american',
      oddsOver: '',
      oddsUnder: '',
      advancedMode: false,
      altLines: [],
    };
  };

  const getPlayerBetDetails = (playerId: string): PlayerBetDetails => {
    return getPlayerBetDetailsFromState(betDetails, playerId);
  };

  const toggleAdvancedMode = (playerId: string) => {
    const current = getPlayerBetDetails(playerId);
    updateBetDetail(playerId, 'advancedMode', !current.advancedMode);
  };

  const addAltLine = (playerId: string) => {
    const current = getPlayerBetDetails(playerId);
    if (current.altLines.length >= 5) {
      toast({
        title: "Maximum lines reached",
        description: "You can only add up to 5 alternate lines.",
        variant: "destructive",
      });
      return;
    }
    const newLine: AltLine = {
      id: crypto.randomUUID(),
      line: '',
      odds: '',
    };
    updateBetDetail(playerId, 'altLines', [...current.altLines, newLine]);
  };

  const removeAltLine = (playerId: string, lineId: string) => {
    const current = getPlayerBetDetails(playerId);
    updateBetDetail(
      playerId, 
      'altLines', 
      current.altLines.filter(l => l.id !== lineId)
    );
  };

  const updateAltLine = (playerId: string, lineId: string, field: 'line' | 'odds', value: string) => {
    const current = getPlayerBetDetails(playerId);
    const updatedLines = current.altLines.map(l => 
      l.id === lineId ? { ...l, [field]: value } : l
    );
    updateBetDetail(playerId, 'altLines', updatedLines);
  };

  const handleManualSave = (playerId: string) => {
    savePlayerDetails(playerId);
    toast({
      title: "Saved",
      description: "Player bet details saved successfully.",
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
              <Receipt className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight">BetSlip</h1>
              <p className="text-muted-foreground">
                {players.length} player{players.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        {players.length === 0 ? (
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

            {/* Player list */}
            <div className="space-y-3">
              {players.map((player) => {
                const isExpanded = expandedPlayers.has(player.id);
                const details = getPlayerBetDetails(player.id);
                const status = saveStatus[player.id] || 'idle';

                return (
                  <Card 
                    key={player.id} 
                    className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors overflow-hidden"
                  >
                    <CardContent className="p-4">
                      {/* Player header row */}
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-primary/20 overflow-hidden flex-shrink-0">
                          {player.image ? (
                            <img 
                              src={player.image} 
                              alt={player.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center ${player.image ? 'hidden' : ''}`}>
                            <User className="w-6 h-6 text-primary" />
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{player.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">{player.team}</p>
                        </div>

                        {/* Auto-save indicator */}
                        {status === 'saved' && (
                          <span className="text-xs text-green-500 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Saved
                          </span>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleExpand(player.id)}
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
                          onClick={() => removePlayer(player.id)}
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
                              <Label htmlFor={`stat-${player.id}`}>Stat Type</Label>
                              <Select
                                value={details.statType}
                                onValueChange={(value) => updateBetDetail(player.id, 'statType', value)}
                              >
                                <SelectTrigger id={`stat-${player.id}`} className="bg-background">
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
                              <Label htmlFor={`line-${player.id}`}>Main Line</Label>
                              <Input
                                id={`line-${player.id}`}
                                type="number"
                                step="0.5"
                                placeholder="e.g., 24.5"
                                value={details.mainLine}
                                onChange={(e) => updateBetDetail(player.id, 'mainLine', e.target.value)}
                                className="bg-background"
                              />
                            </div>

                            {/* Odds Format */}
                            <div className="space-y-2">
                              <Label htmlFor={`format-${player.id}`}>Odds Format</Label>
                              <Select
                                value={details.oddsFormat}
                                onValueChange={(value) => updateBetDetail(player.id, 'oddsFormat', value)}
                              >
                                <SelectTrigger id={`format-${player.id}`} className="bg-background">
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
                              <Label htmlFor={`over-${player.id}`}>Odds Over</Label>
                              <Input
                                id={`over-${player.id}`}
                                type="text"
                                placeholder={details.oddsFormat === 'american' ? 'e.g., -110' : 'e.g., 1.91'}
                                value={details.oddsOver}
                                onChange={(e) => updateBetDetail(player.id, 'oddsOver', e.target.value)}
                                className="bg-background"
                              />
                            </div>

                            {/* Odds Under */}
                            <div className="space-y-2 sm:col-start-2">
                              <Label htmlFor={`under-${player.id}`}>Odds Under</Label>
                              <Input
                                id={`under-${player.id}`}
                                type="text"
                                placeholder={details.oddsFormat === 'american' ? 'e.g., -110' : 'e.g., 1.91'}
                                value={details.oddsUnder}
                                onChange={(e) => updateBetDetail(player.id, 'oddsUnder', e.target.value)}
                                className="bg-background"
                              />
                            </div>
                          </div>

                          {/* Advanced Mode - Alternate Lines */}
                          {details.advancedMode && (
                            <div className="space-y-3 pt-2 border-t border-border/30">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">Alternate Lines</Label>
                                {details.altLines.length < 5 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addAltLine(player.id)}
                                    className="h-7 text-xs"
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add Line
                                  </Button>
                                )}
                              </div>
                              
                              {details.altLines.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No alternate lines added. Click "Add Line" to add up to 5 lines.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {details.altLines.map((altLine, index) => (
                                    <div key={altLine.id} className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground w-6">#{index + 1}</span>
                                      <div className="flex-1 grid grid-cols-2 gap-2">
                                        <Input
                                          type="number"
                                          step="0.5"
                                          placeholder="Line"
                                          value={altLine.line}
                                          onChange={(e) => updateAltLine(player.id, altLine.id, 'line', e.target.value)}
                                          className="bg-background h-9"
                                        />
                                        <Input
                                          type="text"
                                          placeholder="Odds"
                                          value={altLine.odds}
                                          onChange={(e) => updateAltLine(player.id, altLine.id, 'odds', e.target.value)}
                                          className="bg-background h-9"
                                        />
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeAltLine(player.id, altLine.id)}
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
                              onClick={() => toggleAdvancedMode(player.id)}
                            >
                              {details.advancedMode ? 'Basic Mode' : 'Advanced Mode'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleManualSave(player.id)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Save
                            </Button>
                          </div>
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
                  <span className="text-lg font-semibold">Total Players</span>
                  <span className="text-2xl font-bold text-primary">{players.length}</span>
                </div>
                <Button className="w-full" size="lg">
                  Continue with Selection
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
