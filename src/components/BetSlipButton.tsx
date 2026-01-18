import { useNavigate } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBetSlip } from '@/contexts/BetSlipContext';

const BetSlipButton = () => {
  const navigate = useNavigate();
  const { players } = useBetSlip();

  return (
    <Button
      onClick={() => navigate('/betslip')}
      className="fixed top-4 right-4 z-50 gap-2 shadow-lg"
      size="lg"
    >
      <Receipt className="w-5 h-5" />
      BetSlip
      {players.length > 0 && (
        <span className="ml-1 bg-background text-primary px-2 py-0.5 rounded-full text-sm font-bold">
          {players.length}
        </span>
      )}
    </Button>
  );
};

export default BetSlipButton;
