import { useNavigate } from 'react-router-dom';
import SearchBar from './SearchBar';
import TodayFixtures from './TodayFixtures';
import { SearchResult } from '@/hooks/useAutocomplete';

const HeroSection = () => {
  const navigate = useNavigate();

  const handleSearch = (query: string) => {
    console.log('Searching for:', query);
  };

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'player') {
      navigate(`/player/${result.id}`);
    } else {
      navigate(`/team/${result.id}`);
    }
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Background gradient overlay */}
      <div 
        className="absolute inset-0 z-0"
        style={{ background: 'var(--gradient-hero)' }}
      />
      
      {/* Basketball watermark */}
      <div className="basketball-watermark animate-float" />
      
      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto w-full">
        {/* Main Title */}
        <h1 className="hero-title mb-4">
          PROP <span className="text-primary">DECISION</span>
        </h1>
        
        {/* Subtitle */}
        <p className="subtitle mb-12">
          AI-Powered <span className="accent-text">NBA Player Prop</span> Analysis & Predictions
        </p>
        
        {/* Search Bar */}
        <SearchBar onSearch={handleSearch} onSelect={handleSelect} />
        
        {/* Helper text */}
        <p className="text-muted-foreground text-sm mt-6">
          Enter a player name like <span className="text-foreground/80">"LeBron James"</span> or team like <span className="text-foreground/80">"Lakers"</span>
        </p>

        {/* Today's Fixtures */}
        <TodayFixtures />
      </div>
      
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />
    </section>
  );
};

export default HeroSection;
