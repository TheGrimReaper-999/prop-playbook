import React, { createContext, useContext, useState, useCallback } from 'react';

export interface BetSlipPlayer {
  id: string;
  name: string;
  team: string;
  image?: string;
}

interface BetSlipContextType {
  players: BetSlipPlayer[];
  addPlayer: (player: BetSlipPlayer) => void;
  removePlayer: (id: string) => void;
  isPlayerInSlip: (id: string) => boolean;
  clearSlip: () => void;
}

const BetSlipContext = createContext<BetSlipContextType | undefined>(undefined);

export const BetSlipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [players, setPlayers] = useState<BetSlipPlayer[]>([]);

  const addPlayer = useCallback((player: BetSlipPlayer) => {
    setPlayers((prev) => {
      if (prev.some((p) => p.id === player.id)) {
        return prev;
      }
      return [...prev, player];
    });
  }, []);

  const removePlayer = useCallback((id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const isPlayerInSlip = useCallback((id: string) => {
    return players.some((p) => p.id === id);
  }, [players]);

  const clearSlip = useCallback(() => {
    setPlayers([]);
  }, []);

  return (
    <BetSlipContext.Provider value={{ players, addPlayer, removePlayer, isPlayerInSlip, clearSlip }}>
      {children}
    </BetSlipContext.Provider>
  );
};

export const useBetSlip = () => {
  const context = useContext(BetSlipContext);
  if (!context) {
    throw new Error('useBetSlip must be used within a BetSlipProvider');
  }
  return context;
};
