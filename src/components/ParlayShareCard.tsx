import { forwardRef } from 'react';
import { CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, MinusCircle, Zap, Target, Calendar } from 'lucide-react';
import { SavedParlay, ParlayLeg } from '@/contexts/BetSlipContext';
import { ParlayStatus, LegStatus } from '@/hooks/useParlayStatus';

const STAT_TYPE_LABELS: Record<string, string> = {
  pts: 'Points',
  reb: 'Rebounds',
  ast: 'Assists',
  '3pm': '3PM',
  stl: 'Steals',
  blk: 'Blocks',
  pra: 'PRA',
  pr: 'PR',
  pa: 'PA',
  ra: 'RA',
  'stl+blk': 'Stocks',
};

const getDecisionIcon = (decision: string) => {
  switch (decision) {
    case 'TAKE OVER':
      return <TrendingUp className="w-3 h-3 text-green-500" />;
    case 'TAKE UNDER':
      return <TrendingDown className="w-3 h-3 text-red-500" />;
    default:
      return <MinusCircle className="w-3 h-3 text-gray-500" />;
  }
};

const getDecisionColor = (decision: string) => {
  switch (decision) {
    case 'TAKE OVER':
      return 'text-green-500';
    case 'TAKE UNDER':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
};

const getLegStatusIcon = (status: LegStatus) => {
  switch (status) {
    case 'win':
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    case 'loss':
      return <XCircle className="w-3 h-3 text-red-500" />;
    default:
      return <Clock className="w-3 h-3 text-yellow-500" />;
  }
};

interface ParlayShareCardProps {
  parlay: SavedParlay;
  status?: ParlayStatus;
  legStatuses?: Map<string, LegStatus>;
  legActualValues?: Map<string, number | undefined>;
  legOpponents?: Map<string, { abbrev: string; isHome: boolean; gameDate?: string } | undefined>;
}

const ParlayShareCard = forwardRef<HTMLDivElement, ParlayShareCardProps>(
  ({ parlay, status = 'pending', legStatuses, legActualValues, legOpponents }, ref) => {
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    return (
      <div 
        ref={ref}
        className="p-4 rounded-xl w-[360px]"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-white text-lg">{parlay.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span 
                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(249, 115, 22, 0.2)', color: '#f97316' }}
              >
                {parlay.legs.filter(l => l.taken !== false).length} Leg{parlay.legs.filter(l => l.taken !== false).length !== 1 ? 's' : ''}
              </span>
              {parlay.legs.some(l => l.usedAdvancedModel) && (
                <span 
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}
                >
                  <Zap className="w-2.5 h-2.5" />
                  Advanced
                </span>
              )}
              <span 
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ 
                  background: status === 'win' ? 'rgba(34, 197, 94, 0.2)' : 
                             status === 'loss' ? 'rgba(239, 68, 68, 0.2)' : 
                             'rgba(234, 179, 8, 0.2)',
                  color: status === 'win' ? '#22c55e' : 
                        status === 'loss' ? '#ef4444' : 
                        '#eab308'
                }}
              >
                {status === 'win' && <CheckCircle2 className="w-2.5 h-2.5" />}
                {status === 'loss' && <XCircle className="w-2.5 h-2.5" />}
                {status === 'pending' && <Clock className="w-2.5 h-2.5" />}
                {status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <Calendar className="w-3 h-3" />
          {formatDate(parlay.createdAt)}
        </div>

        {/* Legs */}
        <div className="space-y-1.5">
          {parlay.legs.filter(l => l.taken !== false).map((leg, index) => {
            const legStatus = legStatuses?.get(leg.legId);
            const actualValue = legActualValues?.get(leg.legId);
            const opponent = legOpponents?.get(leg.legId);
            
            return (
              <div
                key={leg.legId}
                className="flex items-center gap-2 p-2 rounded-lg text-sm"
                style={{
                  background: legStatus === 'win' ? 'rgba(34, 197, 94, 0.1)' :
                             legStatus === 'loss' ? 'rgba(239, 68, 68, 0.1)' :
                             'rgba(255,255,255,0.05)',
                  border: legStatus === 'win' ? '1px solid rgba(34, 197, 94, 0.3)' :
                         legStatus === 'loss' ? '1px solid rgba(239, 68, 68, 0.3)' :
                         '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <span className="text-xs font-medium w-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  #{index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{leg.player.name}</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {STAT_TYPE_LABELS[leg.statType] || leg.statType} {leg.mainLine}
                    </span>
                    {opponent && (
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        • {opponent.isHome ? 'vs' : '@'} {opponent.abbrev}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {getDecisionIcon(leg.decision)}
                  <span className={`text-xs font-semibold ${getDecisionColor(leg.decision)}`}>
                    {leg.decision === 'TAKE OVER' ? 'O' : leg.decision === 'TAKE UNDER' ? 'U' : '-'}
                  </span>
                  {leg.confidence && (
                    <span 
                      className="flex items-center gap-0.5 text-xs px-1 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
                    >
                      <Target className="w-2.5 h-2.5" />
                      {leg.confidence.split('_')[0]}
                    </span>
                  )}
                  {actualValue !== undefined && (
                    <span 
                      className="text-xs font-semibold"
                      style={{ 
                        color: legStatus === 'win' ? '#22c55e' : 
                              legStatus === 'loss' ? '#ef4444' : 
                              'rgba(255,255,255,0.7)'
                      }}
                    >
                      {actualValue}
                    </span>
                  )}
                  {legStatus && getLegStatusIcon(legStatus)}
                </div>
              </div>
            );
          })}
        </div>

        {/* P&L */}
        {parlay.pnl !== null && parlay.pnl !== undefined && (
          <div 
            className="mt-3 pt-2 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>P&L</span>
            <span 
              className="text-lg font-bold"
              style={{ color: parlay.pnl > 0 ? '#22c55e' : parlay.pnl < 0 ? '#ef4444' : 'white' }}
            >
              {parlay.pnl > 0 ? '+' : ''}{parlay.pnl.toFixed(2)}
            </span>
          </div>
        )}

        {/* Branding */}
        <div 
          className="mt-3 pt-2 flex items-center justify-center gap-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span className="text-xs font-bold" style={{ color: '#f97316' }}>PROP DECISION</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>• AI-Powered Props</span>
        </div>
      </div>
    );
  }
);

ParlayShareCard.displayName = 'ParlayShareCard';

export default ParlayShareCard;
