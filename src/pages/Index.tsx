import HeroSection from '@/components/HeroSection';
import BetSlipOverlay from '@/components/BetSlipOverlay';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { LogIn, User, Layers, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const { user, loading } = useAuth();
  const { profile } = useProfile();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Auth and nav buttons - responsive header */}
      <div className="fixed top-0 left-0 right-0 z-50 p-3 sm:p-4 flex items-center justify-between bg-gradient-to-b from-background via-background/80 to-transparent">
        {/* Left side - Parlays button */}
        <div className="flex gap-2">
          {!loading && user && (
            <Button
              onClick={() => navigate('/parlays')}
              variant="outline"
              className="gap-2 shadow-lg bg-background/80 backdrop-blur-sm"
              size="sm"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Parlays</span>
            </Button>
          )}
        </div>

        {/* Right side - Auth buttons */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="bg-card/80 backdrop-blur-sm border-border/50 gap-2"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </Button>

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
                <span className="hidden sm:inline">{profile?.display_name || 'Profile'}</span>
              </Button>
            ) : (
              <Button onClick={() => navigate('/auth')} size="sm" className="shadow-lg">
                <LogIn className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            )
          )}
        </div>
      </div>
      
      {/* BetSlip floating button and overlay */}
      <BetSlipOverlay />
      
      <HeroSection />
      
      <Footer />
    </main>
  );
};

export default Index;
