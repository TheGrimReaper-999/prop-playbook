import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, TrendingUp, TrendingDown, MinusCircle, Layers, Calendar, Clock, CheckCircle2, XCircle, Pencil, Loader2, DollarSign, LogIn, Zap, Target, RefreshCw, BarChart3, Share2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useBetSlip, SavedParlay, ParlayLeg } from '@/contexts/BetSlipContext';
import { toast } from '@/hooks/use-toast';
import { useParlayStatus, ParlayStatus, LegStatus } from '@/hooks/useParlayStatus';
import { useAuth } from '@/hooks/useAuth';
import { useAutoSyncParlayPlayers } from '@/hooks/useAutoSyncParlayPlayers';
import Footer from '@/components/Footer';
import ParlayShareCard from '@/components/ParlayShareCard';
const STAT_TYPE_LABELS: Record<string, string> = {
  pts: 'Points',
  reb: 'Rebounds',
  ast: 'Assists',
  '3pm': '3-Pointers Made',
  stl: 'Steals',
  blk: 'Blocks',
  pra: 'Pts + Reb + Ast',
  pr: 'Pts + Reb',
  pa: 'Pts + Ast',
  ra: 'Reb + Ast',
  'stl+blk': 'Steals + Blocks',
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
        <span className="flex items-center gap-1 sm:gap-1.5 bg-green-500/20 text-green-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          WIN
        </span>
      );
    case 'loss':
      return (
        <span className="flex items-center gap-1 sm:gap-1.5 bg-red-500/20 text-red-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold">
          <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          LOSS
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 sm:gap-1.5 bg-yellow-500/20 text-yellow-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
  onRename: (id: string) => void;
  onPnlUpdate: (id: string, pnl: number | null) => void;
  onLegTakenToggle: (parlayId: string, legId: string, taken: boolean) => void;
  onShare: (parlayId: string) => void;
  status?: ParlayStatus;
  legStatuses?: Map<string, LegStatus>;
  legActualValues?: Map<string, number | undefined>;
  legOpponents?: Map<string, { abbrev: string; isHome: boolean; gameDate?: string } | undefined>;
  isDeleting?: boolean;
  isSharing?: boolean;
}

const ParlayCard = ({ parlay, onDelete, onRename, onPnlUpdate, onLegTakenToggle, onShare, status = 'pending', legStatuses, legActualValues, legOpponents, isDeleting, isSharing }: ParlayCardProps) => {
  const [pnlInput, setPnlInput] = useState<string>(parlay.pnl?.toString() ?? '');
  const [isUpdatingPnl, setIsUpdatingPnl] = useState(false);

  // Check if at least one leg is marked as taken (treat undefined as taken)
  const hasAnyTakenLeg = parlay.legs.some(leg => leg.taken !== false);

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

  const handlePnlBlur = async () => {
    const newPnl = pnlInput.trim() === '' ? null : parseFloat(pnlInput);
    if (newPnl === parlay.pnl || (pnlInput.trim() === '' && parlay.pnl === null)) return;
    if (pnlInput.trim() !== '' && isNaN(newPnl!)) {
      setPnlInput(parlay.pnl?.toString() ?? '');
      return;
    }
    setIsUpdatingPnl(true);
    try {
      await onPnlUpdate(parlay.id, newPnl);
    } finally {
      setIsUpdatingPnl(false);
    }
  };

  return (
    <Card className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors">
      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-4">
          {/* Top row: Name and delete button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h3 className="font-bold text-base sm:text-lg truncate">{parlay.name}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRename(parlay.id)}
                className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onShare(parlay.id)}
                disabled={isSharing}
                className="flex-shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8"
                title="Share parlay"
              >
                {isSharing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(parlay.id)}
                disabled={isDeleting}
                className="flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          {/* Bottom row: Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-primary/20 text-primary px-2.5 py-1 rounded-full text-xs sm:text-sm font-semibold">
              {parlay.legs.length} Leg{parlay.legs.length !== 1 ? 's' : ''}
            </span>
            {parlay.legs.some(l => l.taken === false) && (
              <span className="bg-blue-500/20 text-blue-500 px-2.5 py-1 rounded-full text-xs sm:text-sm font-semibold">
                {parlay.legs.filter(l => l.taken !== false).length} Taken
              </span>
            )}
            {/* Show if any leg used advanced model */}
            {parlay.legs.some(l => l.usedAdvancedModel) && (
              <span className="flex items-center gap-1 bg-amber-500/20 text-amber-500 px-2.5 py-1 rounded-full text-xs sm:text-sm font-semibold">
                <Zap className="w-3 h-3" />
                Advanced
              </span>
            )}
            {getStatusBadge(status)}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Calendar className="w-4 h-4" />
          {formatDate(parlay.createdAt)}
        </div>

        {/* Legs */}
        <div className="space-y-2">
          {parlay.legs.map((leg, index) => {
            const legStatus = legStatuses?.get(leg.legId);
            const actualValue = legActualValues?.get(leg.legId);
            const opponent = legOpponents?.get(leg.legId);
            const hasResult = legStatus && legStatus !== 'pending';
            // Treat undefined/null taken as true (taken by default)
            const isTaken = leg.taken !== false;
            
            return (
              <div
                key={leg.legId}
                className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg ${
                  legStatus === 'win' ? 'bg-green-500/10 border border-green-500/30' :
                  legStatus === 'loss' ? 'bg-red-500/10 border border-red-500/30' :
                  'bg-background/50'
                } ${!isTaken ? 'opacity-60' : ''}`}
              >
                {/* Top row on mobile: checkbox + index + player name */}
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <Checkbox
                    checked={isTaken}
                    onCheckedChange={(checked) => onLegTakenToggle(parlay.id, leg.legId, checked === true)}
                    className="flex-shrink-0"
                    aria-label={`Mark leg ${index + 1} as taken`}
                  />
                  <span className="text-xs text-muted-foreground font-medium w-5 sm:w-6 flex-shrink-0">
                    #{index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <p className={`font-medium text-sm sm:text-base ${!isTaken ? 'line-through' : ''}`}>
                        {leg.player.name}
                      </p>
                      {opponent && (
                        <span className="text-muted-foreground text-xs sm:text-sm">
                          {opponent.isHome ? 'vs' : '@'} {opponent.abbrev}
                          {opponent.gameDate && (
                            <span className="ml-1 text-xs">
                              ({new Date(opponent.gameDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                      <span>{STAT_TYPE_LABELS[leg.statType] || leg.statType}</span>
                      <span>•</span>
                      <span>Line: {leg.mainLine}</span>
                      {actualValue !== undefined && (
                        <>
                          <span>•</span>
                          <span className={
                            legStatus === 'win' ? 'text-green-500 font-semibold' : 
                            legStatus === 'loss' ? 'text-red-500 font-semibold' : 
                            'text-muted-foreground font-semibold'
                          }>
                            Actual: {actualValue}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {/* Decision + confidence + status */}
                <div className="flex items-center gap-2 pl-7 sm:pl-0 flex-wrap">
                  {getDecisionIcon(leg.decision)}
                  <span className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${getDecisionColor(leg.decision)}`}>
                    {leg.decision}
                  </span>
                  {/* Confidence badge */}
                  {leg.confidence && (
                    <span className="flex items-center gap-1 text-xs bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded">
                      <Target className="w-3 h-3" />
                      {leg.confidence.replace('_', ' ')}
                    </span>
                  )}
                  {legStatus && getLegStatusIcon(legStatus)}
                </div>
              </div>
            );
          })}
        </div>

        {/* PnL Input - only show if at least one leg is taken */}
        {hasAnyTakenLeg && (
          <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">P&L:</span>
            <div className="relative flex-1 max-w-[150px]">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="+100 or -50"
                value={pnlInput}
                onChange={(e) => setPnlInput(e.target.value)}
                onBlur={handlePnlBlur}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                disabled={isUpdatingPnl}
                className={`h-9 text-sm ${
                  parlay.pnl && parlay.pnl > 0 ? 'text-green-500' : 
                  parlay.pnl && parlay.pnl < 0 ? 'text-red-500' : ''
                }`}
              />
              {isUpdatingPnl && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {parlay.pnl !== null && parlay.pnl !== undefined && (
              <span className={`text-sm font-semibold ${parlay.pnl > 0 ? 'text-green-500' : parlay.pnl < 0 ? 'text-red-500' : ''}`}>
                {parlay.pnl > 0 ? '+' : ''}{parlay.pnl.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Parlays = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { parlays, parlaysLoading, deleteParlay, renameParlay, updateParlayPnl, updateParlayLegs, clearParlays } = useBetSlip();
  const { data: parlayStatuses, refetch: refetchParlayStatus } = useParlayStatus(parlays);
  
  // Auto-sync player stats for pending parlay legs
  const { isSyncing, refreshAll } = useAutoSyncParlayPlayers(parlays, parlayStatuses, refetchParlayStatus);
  
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renamingParlayId, setRenamingParlayId] = useState<string | null>(null);
  const [newParlayName, setNewParlayName] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const shareCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Calculate total PnL - must be before early returns
  const totalPnl = useMemo(() => {
    return parlays.reduce((sum, p) => sum + (p.pnl || 0), 0);
  }, [parlays]);

  const parlaysWithPnl = useMemo(() => {
    return parlays.filter(p => p.pnl !== null && p.pnl !== undefined);
  }, [parlays]);

  const handleClearAll = () => {
    if (parlays.length === 0) return;
    clearParlays();
    toast({
      title: "All parlays cleared",
      description: "Your parlays have been removed.",
    });
  };

  const handleDelete = async (parlayId: string) => {
    setIsDeleting(parlayId);
    try {
      await deleteParlay(parlayId);
      toast({
        title: "Parlay deleted",
        description: "The parlay has been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete parlay. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleStartRename = (parlayId: string) => {
    const parlay = parlays.find(p => p.id === parlayId);
    if (parlay) {
      setRenamingParlayId(parlayId);
      setNewParlayName(parlay.name);
      setShowRenameDialog(true);
    }
  };

  const handleLegTakenToggle = async (parlayId: string, legId: string, taken: boolean) => {
    const parlay = parlays.find(p => p.id === parlayId);
    if (!parlay) return;
    
    const updatedLegs = parlay.legs.map(leg => 
      leg.legId === legId ? { ...leg, taken } : leg
    );
    
    try {
      await updateParlayLegs(parlayId, updatedLegs);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update leg. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePnlUpdate = async (parlayId: string, pnl: number | null) => {
    try {
      await updateParlayPnl(parlayId, pnl);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update P&L. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Share parlay as image
  const handleShare = useCallback(async (parlayId: string) => {
    const parlay = parlays.find(p => p.id === parlayId);
    if (!parlay) return;

    setIsSharing(parlayId);
    
    try {
      // Get the result status for this parlay
      const result = parlayStatuses?.get(parlayId);
      const legStatusMap = new Map<string, LegStatus>();
      const legActualValuesMap = new Map<string, number | undefined>();
      const legOpponentsMap = new Map<string, { abbrev: string; isHome: boolean; gameDate?: string } | undefined>();
      
      result?.legResults.forEach(lr => {
        legStatusMap.set(lr.legId, lr.status);
        legActualValuesMap.set(lr.legId, lr.actualValue);
        if (lr.opponentAbbrev) {
          legOpponentsMap.set(lr.legId, { abbrev: lr.opponentAbbrev, isHome: lr.isHome ?? false, gameDate: lr.gameDate });
        }
      });

      // Create a temporary container for the share card
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);

      // Render the share card
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(container);
      
      await new Promise<void>((resolve) => {
        root.render(
          <ParlayShareCard
            parlay={parlay}
            status={result?.status}
            legStatuses={legStatusMap}
            legActualValues={legActualValuesMap}
            legOpponents={legOpponentsMap}
          />
        );
        // Wait for render
        setTimeout(resolve, 100);
      });

      const cardElement = container.firstElementChild as HTMLElement;
      if (!cardElement) throw new Error('Failed to render share card');

      // Generate the image
      const dataUrl = await toPng(cardElement, {
        quality: 1,
        pixelRatio: 2,
      });

      // Clean up
      root.unmount();
      document.body.removeChild(container);

      // Convert to blob for sharing
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `${parlay.name.replace(/\s+/g, '-')}-parlay.png`, { type: 'image/png' });

      // Try Web Share API first (mobile)
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${parlay.name} - Prop Decision`,
          text: `Check out my ${parlay.legs.filter(l => l.taken !== false).length}-leg parlay!`,
          files: [file],
        });
        toast({
          title: "Shared!",
          description: "Parlay shared successfully.",
        });
      } else {
        // Fallback: download the image
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${parlay.name.replace(/\s+/g, '-')}-parlay.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Image saved",
          description: "Parlay image downloaded to your device.",
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      toast({
        title: "Share failed",
        description: "Could not generate parlay image. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(null);
    }
  }, [parlays, parlayStatuses]);

  // Show auth prompt if not logged in - AFTER all hooks
  if (!authLoading && !user) {
    return (
      <main className="min-h-screen bg-background">
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
                <h1 className="text-4xl font-black tracking-tight">Parlays</h1>
                <p className="text-muted-foreground">Sign in to save your parlays</p>
              </div>
            </div>
          </div>
        </div>

      <div className="max-w-4xl mx-auto p-3 sm:p-6">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 mx-auto mb-4 flex items-center justify-center">
                <LogIn className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
              <p className="text-muted-foreground mb-6">
                Create an account or sign in to save and track your parlays
              </p>
              <Button onClick={() => navigate('/auth')} size="lg">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In / Sign Up
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const handleConfirmRename = async () => {
    if (renamingParlayId && newParlayName.trim()) {
      setIsRenaming(true);
      try {
        await renameParlay(renamingParlayId, newParlayName.trim());
        toast({
          title: "Parlay renamed",
          description: "Your parlay has been renamed successfully.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to rename parlay. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsRenaming(false);
      }
    }
    setShowRenameDialog(false);
    setRenamingParlayId(null);
    setNewParlayName('');
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/20 to-background p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4 sm:mb-6 hover:bg-primary/10 -ml-2"
            size="sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Layers className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight">Parlays</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {parlays.length} parlay{parlays.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        {parlaysLoading ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-12 text-center">
              <Loader2 className="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-semibold mb-2">Loading parlays...</h2>
              <p className="text-muted-foreground">
                Fetching your saved parlays
              </p>
            </CardContent>
          </Card>
        ) : parlays.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <Layers className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No parlays yet</h2>
              <p className="text-muted-foreground mb-6">
                Add legs to your BetSlip and save them as parlays from the Decisions page
              </p>
              <Button onClick={() => navigate('/betslip')}>Go to BetSlip</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Syncing indicator / Refresh button */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {isSyncing ? (
                <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5 text-xs sm:text-sm">
                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                  <span>Syncing...</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/profile')}
                  className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9"
                >
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">View </span>Stats
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshAll}
                disabled={isSyncing}
                className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9"
              >
                <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            {/* Total PnL */}
            <Card className={`border-2 ${totalPnl > 0 ? 'border-green-500/50 bg-green-500/10' : totalPnl < 0 ? 'border-red-500/50 bg-red-500/10' : 'border-border/50 bg-card/50'}`}>
              <CardContent className="p-3 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      totalPnl > 0 ? 'bg-green-500/20' : totalPnl < 0 ? 'bg-red-500/20' : 'bg-muted'
                    }`}>
                      <DollarSign className={`w-5 h-5 sm:w-6 sm:h-6 ${
                        totalPnl > 0 ? 'text-green-500' : totalPnl < 0 ? 'text-red-500' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-base sm:text-lg">Total P&L</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {parlaysWithPnl.length}/{parlays.length} tracked
                      </p>
                    </div>
                  </div>
                  <span className={`text-2xl sm:text-3xl font-black flex-shrink-0 ${
                    totalPnl > 0 ? 'text-green-500' : totalPnl < 0 ? 'text-red-500' : 'text-foreground'
                  }`}>
                    {totalPnl > 0 ? '+' : ''}{totalPnl.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
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
                const legActualValuesMap = new Map<string, number | undefined>();
                const legOpponentsMap = new Map<string, { abbrev: string; isHome: boolean; gameDate?: string } | undefined>();
                result?.legResults.forEach(lr => {
                  legStatusMap.set(lr.legId, lr.status);
                  legActualValuesMap.set(lr.legId, lr.actualValue);
                  if (lr.opponentAbbrev) {
                    legOpponentsMap.set(lr.legId, { abbrev: lr.opponentAbbrev, isHome: lr.isHome ?? false, gameDate: lr.gameDate });
                  }
                });
                
                return (
                  <ParlayCard 
                    key={parlay.id} 
                    parlay={parlay} 
                    onDelete={handleDelete}
                    onRename={handleStartRename}
                    onPnlUpdate={handlePnlUpdate}
                    onLegTakenToggle={handleLegTakenToggle}
                    onShare={handleShare}
                    status={result?.status}
                    legStatuses={legStatusMap}
                    legActualValues={legActualValuesMap}
                    legOpponents={legOpponentsMap}
                    isDeleting={isDeleting === parlay.id}
                    isSharing={isSharing === parlay.id}
                  />
                );
              })}
            </div>

            {/* PnL Summary moved to top */}

            {/* Action Button */}
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-6">
            <Button className="w-full" size="default" onClick={() => navigate('/betslip')}>
              Create New BetSlip
            </Button>
          </CardContent>
        </Card>
          </div>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Parlay</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter new name..."
              value={newParlayName}
              onChange={(e) => setNewParlayName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)} disabled={isRenaming}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRename} disabled={isRenaming}>
              {isRenaming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </main>
  );
};

export default Parlays;
