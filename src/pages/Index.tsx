import HeroSection from '@/components/HeroSection';
import BetSlipOverlay from '@/components/BetSlipOverlay';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { LogIn, User, Layers } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const Index = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';

  return (
    <main className="min-h-screen bg-background pb-40">
      {/* Auth buttons in top right */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {!loading && (
          user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/profile')}
              className="bg-card/80 backdrop-blur-sm border-border/50"
            >
              <User className="w-4 h-4 mr-2" />
              {displayName}
            </Button>
          ) : (
            <Button onClick={() => navigate('/auth')} size="sm" className="shadow-lg">
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          )
        )}
      </div>
      
      {/* Nav buttons - search and parlays (left side on home page to not conflict with auth buttons) */}
      <div className="fixed top-4 left-4 z-50 flex gap-2">
        {!loading && user && (
          <Button
            onClick={() => navigate('/parlays')}
            variant="outline"
            className="gap-2 shadow-lg bg-background/80 backdrop-blur-sm"
            size="lg"
          >
            <Layers className="w-5 h-5" />
            Parlays
          </Button>
        )}
      </div>
      
      {/* BetSlip floating button and overlay */}
      <BetSlipOverlay />
      
      <HeroSection />
      
      {/* Footer */}
      <footer className="text-center py-8 text-muted-foreground text-sm space-y-2">
        <div className="flex justify-center gap-4">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <span>•</span>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <span>•</span>
          <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
        </div>
        <p>© {new Date().getFullYear()} BreakingBets LLC. All rights reserved.</p>
      </footer>
    </main>
  );
};

export default Index;
