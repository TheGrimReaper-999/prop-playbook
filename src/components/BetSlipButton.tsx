import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Search, X, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SearchBar from '@/components/SearchBar';
import { SearchResult } from '@/hooks/useAutocomplete';
import { useBetSlip } from '@/contexts/BetSlipContext';

interface BetSlipButtonProps {
  showSearch?: boolean;
}

const BetSlipButton = ({ showSearch = true }: BetSlipButtonProps) => {
  const navigate = useNavigate();
  const { legs, parlays } = useBetSlip();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleSelect = (result: SearchResult) => {
    setIsSearchOpen(false);
    if (result.type === 'player') {
      navigate(`/player/${result.id}`);
    } else {
      navigate(`/team/${result.id}`);
    }
  };

  return (
    <>
      {/* Fixed buttons container */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        {showSearch && (
          <Button
            onClick={() => setIsSearchOpen(true)}
            variant="outline"
            size="lg"
            className="shadow-lg bg-background/80 backdrop-blur-sm"
          >
            <Search className="w-5 h-5" />
          </Button>
        )}
        <Button
          onClick={() => navigate('/parlays')}
          variant="outline"
          className="gap-2 shadow-lg bg-background/80 backdrop-blur-sm"
          size="lg"
        >
          <Layers className="w-5 h-5" />
          Saved Bets
          {parlays.length > 0 && (
            <span className="ml-1 bg-primary text-primary-foreground px-2 py-0.5 rounded-full text-sm font-bold">
              {parlays.length}
            </span>
          )}
        </Button>
        <Button
          onClick={() => navigate('/betslip')}
          className="gap-2 shadow-lg"
          size="lg"
        >
          <Receipt className="w-5 h-5" />
          BetSlip
          {legs.length > 0 && (
            <span className="ml-1 bg-background text-primary px-2 py-0.5 rounded-full text-sm font-bold">
              {legs.length}
            </span>
          )}
        </Button>
      </div>

      {/* Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsSearchOpen(false)}
          />
          
          {/* Search Container */}
          <div className="relative z-10 w-full max-w-2xl px-4">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-12 right-0 text-muted-foreground hover:text-foreground"
                onClick={() => setIsSearchOpen(false)}
              >
                <X className="w-6 h-6" />
              </Button>
              <SearchBar 
                onSelect={handleSelect}
                onSearch={() => {}}
              />
              <p className="text-muted-foreground text-sm mt-4 text-center">
                Search for a player or team
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BetSlipButton;
