import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, TrendingUp, TrendingDown, MinusCircle, Layers, Calendar, Clock, CheckCircle2, XCircle, Pencil, Loader2, DollarSign, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useBetSlip, SavedParlay, ParlayLeg } from '@/contexts/BetSlipContext';
import { toast } from '@/hooks/use-toast';
import { useParlayStatus, ParlayStatus, LegStatus } from '@/hooks/useParlayStatus';
import { useAuth } from '@/hooks/useAuth';
import Footer from '@/components/Footer';
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

interface LegActualValue {
  legId: string;
  actualValue?: number;
}

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
  status?: ParlayStatus;
  legStatuses?: Map<string, LegStatus>;
  legActualValues?: Map<string, number | undefined>;
  isDeleting?: boolean;
}

const ParlayCard = ({ parlay, onDelete, onRename, onPnlUpdate, onLegTakenToggle, status = 'pending', legStatuses, legActualValues, isDeleting }: ParlayCardProps) => {
  const [pnlInput, setPnlInput] = useState<string>(parlay.pnl?.toString() ?? '');
  const [isUpdatingPnl, setIsUpdatingPnl] = useState(false);

  // Check if at least one leg is marked as taken
  const hasAnyTakenLeg = parlay.legs.some(leg => leg.taken === true);

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(parlay.id)}
              disabled={isDeleting}
              className="flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              {isDeleting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </Button>
          </div>
          {/* Bottom row: Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-primary/20 text-primary px-2.5 py-1 rounded-full text-xs sm:text-sm font-semibold">
              {parlay.legs.length} Leg{parlay.legs.length !== 1 ? 's' : ''}
            </span>
            {hasAnyTakenLeg && (
              <span className="bg-blue-500/20 text-blue-500 px-2.5 py-1 rounded-full text-xs sm:text-sm font-semibold">
                {parlay.legs.filter(l => l.taken).length} Taken
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
            const hasResult = legStatus && legStatus !== 'pending';
            const isTaken = leg.taken === true;
            
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
                    <p className={`font-medium text-sm sm:text-base ${!isTaken ? 'line-through' : ''}`}>{leg.player.name}</p>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                      <span>{STAT_TYPE_LABELS[leg.statType] || leg.statType}</span>
                      <span>•</span>
                      <span>Line: {leg.mainLine}</span>
                      {hasResult && actualValue !== undefined && (
                        <>
                          <span>•</span>
                          <span className={legStatus === 'win' ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
                            Actual: {actualValue}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {/* Decision + status */}
                <div className="flex items-center gap-2 pl-7 sm:pl-0">
                  {getDecisionIcon(leg.decision)}
                  <span className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${getDecisionColor(leg.decision)}`}>
                    {leg.decision}
                  </span>
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
  const { data: parlayStatuses } = useParlayStatus(parlays);
  
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renamingParlayId, setRenamingParlayId] = useState<string | null>(null);
  const [newParlayName, setNewParlayName] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

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

        <div className="max-w-4xl mx-auto p-6">
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
              <p className="text-muted-foreground">
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
          <div className="space-y-6">
            {/* Total PnL */}
            <Card className={`border-2 ${totalPnl > 0 ? 'border-green-500/50 bg-green-500/10' : totalPnl < 0 ? 'border-red-500/50 bg-red-500/10' : 'border-border/50 bg-card/50'}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      totalPnl > 0 ? 'bg-green-500/20' : totalPnl < 0 ? 'bg-red-500/20' : 'bg-muted'
                    }`}>
                      <DollarSign className={`w-6 h-6 ${
                        totalPnl > 0 ? 'text-green-500' : totalPnl < 0 ? 'text-red-500' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Total P&L</h3>
                      <p className="text-sm text-muted-foreground">
                        {parlaysWithPnl.length} of {parlays.length} parlays tracked
                      </p>
                    </div>
                  </div>
                  <span className={`text-3xl font-black ${
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
                result?.legResults.forEach(lr => {
                  legStatusMap.set(lr.legId, lr.status);
                  legActualValuesMap.set(lr.legId, lr.actualValue);
                });
                
                return (
                  <ParlayCard 
                    key={parlay.id} 
                    parlay={parlay} 
                    onDelete={handleDelete}
                    onRename={handleStartRename}
                    onPnlUpdate={handlePnlUpdate}
                    onLegTakenToggle={handleLegTakenToggle}
                    status={result?.status}
                    legStatuses={legStatusMap}
                    legActualValues={legActualValuesMap}
                    isDeleting={isDeleting === parlay.id}
                  />
                );
              })}
            </div>

            {/* PnL Summary moved to top */}

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
