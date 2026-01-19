import HeroSection from '@/components/HeroSection';
import NavButtons from '@/components/NavButtons';
import BetSlipOverlay from '@/components/BetSlipOverlay';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to sign out. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Signed out',
        description: 'You have been signed out.',
      });
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Auth buttons in top right */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {!loading && (
          user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-card/80 backdrop-blur-sm rounded-full border border-border/50">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground max-w-[150px] truncate">
                  {user.email}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="bg-background/80 backdrop-blur-sm">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          ) : (
            <Button onClick={() => navigate('/auth')} size="sm" className="shadow-lg">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          )
        )}
      </div>
      
      {/* Nav buttons - search and parlays (left side) */}
      <NavButtons showSearch={false} />
      
      {/* BetSlip floating button and overlay */}
      <BetSlipOverlay />
      
      <HeroSection />
    </main>
  );
};

export default Index;
