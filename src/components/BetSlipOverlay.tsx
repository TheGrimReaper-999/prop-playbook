import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, User, Trash2, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBetSlip } from '@/contexts/BetSlipContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const STAT_TYPES_MAP: Record<string, string> = {
  pts: 'Points',
  reb: 'Rebounds',
  ast: 'Assists',
  '3pm': '3PM',
  pra: 'PRA',
  pr: 'P+R',
  pa: 'P+A',
  ra: 'R+A',
};

const BetSlipOverlay = () => {
  const navigate = useNavigate();
  const { legs, removeLeg, clearSlip } = useBetSlip();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenFullBetSlip = () => {
    setIsOpen(false);
    navigate('/betslip');
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-xl hover:scale-105 transition-transform"
          size="icon"
        >
          <div className="relative">
            <Receipt className="w-7 h-7" />
            {legs.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-background text-primary w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center border-2 border-primary">
                {legs.length}
              </span>
            )}
          </div>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold">BetSlip</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {legs.length} leg{legs.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {legs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSlip}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {legs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted mb-4 flex items-center justify-center">
                <Receipt className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">Your BetSlip is empty</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add players from team rosters
              </p>
              <Button variant="outline" onClick={() => { setIsOpen(false); navigate('/'); }}>
                Browse Players
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {legs.map((leg, index) => (
                <Card key={leg.legId} className="bg-card/50 border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-primary/20 overflow-hidden flex-shrink-0">
                        {leg.player.image ? (
                          <img 
                            src={leg.player.image} 
                            alt={leg.player.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{leg.player.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {leg.player.team}
                          {leg.details.statType && (
                            <span className="text-primary ml-1">
                              • {STAT_TYPES_MAP[leg.details.statType] || leg.details.statType}
                              {leg.details.mainLine && ` ${leg.details.mainLine}`}
                            </span>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLeg(leg.legId)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {legs.length > 0 && (
          <div className="p-4 border-t border-border/50 space-y-2">
            <Button className="w-full" size="lg" onClick={handleOpenFullBetSlip}>
              Configure & Analyze
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default BetSlipOverlay;
