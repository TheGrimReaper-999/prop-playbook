import HeroSection from '@/components/HeroSection';
import BetSlipButton from '@/components/BetSlipButton';

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      <BetSlipButton showSearch={false} />
      <HeroSection />
    </main>
  );
};

export default Index;
