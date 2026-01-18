import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, User, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBetSlip } from '@/contexts/BetSlipContext';

const BetSlip = () => {
  const navigate = useNavigate();
  const { players, removePlayer, clearSlip } = useBetSlip();

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
              {players.map((player) => (
                <Card 
                  key={player.id} 
                  className="bg-card/50 border-border/50 hover:bg-card/80 transition-colors"
                >
                  <CardContent className="p-4 flex items-center gap-4">
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

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePlayer(player.id)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
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
