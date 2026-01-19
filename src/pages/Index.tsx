import HeroSection from '@/components/HeroSection';
import BetSlipOverlay from '@/components/BetSlipOverlay';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { LogIn, User, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Auth buttons in top right */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {!loading && (
          user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/profile')}
              className="bg-card/80 backdrop-blur-sm border-border/50 gap-2"
            >
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Avatar" 
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4" />
              )}
              {profile?.display_name || 'Profile'}
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
      
      <Footer />
    </main>
  );
};

export default Index;
