import React, { createContext, useContext, useState, useCallback } from 'react';

export interface BetSlipPlayer {
  id: string;
  name: string;
  team: string;
  image?: string;
}

export interface AltLine {
  id: string;
  line: string;
  odds: string;
  oddsOver?: string;
  oddsUnder?: string;
}

export interface LegDetails {
  statType: string;
  mainLine: string;
  oddsFormat: string;
  oddsOver: string;
  oddsUnder: string;
  advancedMode: boolean;
  altLines: AltLine[];
}

export interface BetSlipLeg {
  legId: string;
  player: BetSlipPlayer;
  details: LegDetails;
}

export interface ParlayLeg {
  legId: string;
  player: BetSlipPlayer;
  statType: string;
  mainLine: string;
  decision: 'TAKE OVER' | 'TAKE UNDER' | 'NO BET';
  oddsFormat: string;
  oddsOver: string;
  oddsUnder: string;
}

export interface SavedParlay {
  id: string;
  name: string;
  legs: ParlayLeg[];
  createdAt: string;
}

interface BetSlipContextType {
  legs: BetSlipLeg[];
  addPlayer: (player: BetSlipPlayer) => void;
  removeLeg: (legId: string) => void;
  duplicateLeg: (legId: string) => void;
  updateLegDetails: (legId: string, details: Partial<LegDetails>) => void;
  isPlayerInSlip: (id: string) => boolean;
  clearSlip: () => void;
  // Legacy support for player-based operations
  players: BetSlipPlayer[];
  removePlayer: (id: string) => void;
  // Parlay operations
  parlays: SavedParlay[];
  saveParlay: (legs: ParlayLeg[], name?: string) => void;
  deleteParlay: (parlayId: string) => void;
  clearParlays: () => void;
}

const defaultLegDetails: LegDetails = {
  statType: '',
  mainLine: '',
  oddsFormat: 'american',
  oddsOver: '',
  oddsUnder: '',
  advancedMode: false,
  altLines: [],
};

const BetSlipContext = createContext<BetSlipContextType | undefined>(undefined);

// Load parlays from localStorage
const loadParlaysFromStorage = (): SavedParlay[] => {
  try {
    const stored = localStorage.getItem('savedParlays');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save parlays to localStorage
const saveParlaysToStorage = (parlays: SavedParlay[]) => {
  try {
    localStorage.setItem('savedParlays', JSON.stringify(parlays));
  } catch (e) {
    console.error('Failed to save parlays to localStorage:', e);
  }
};

export const BetSlipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [legs, setLegs] = useState<BetSlipLeg[]>([]);
  const [parlays, setParlays] = useState<SavedParlay[]>(() => loadParlaysFromStorage());

  const addPlayer = useCallback((player: BetSlipPlayer) => {
    setLegs((prev) => {
      // Check if this player already has a leg without stat type
      const existingEmptyLeg = prev.find(
        (leg) => leg.player.id === player.id && !leg.details.statType
      );
      if (existingEmptyLeg) {
        return prev;
      }
      
      const newLeg: BetSlipLeg = {
        legId: crypto.randomUUID(),
        player,
        details: { ...defaultLegDetails },
      };
      return [...prev, newLeg];
    });
  }, []);

  const removeLeg = useCallback((legId: string) => {
    setLegs((prev) => prev.filter((leg) => leg.legId !== legId));
  }, []);

  const duplicateLeg = useCallback((legId: string) => {
    setLegs((prev) => {
      const legToDuplicate = prev.find((leg) => leg.legId === legId);
      if (!legToDuplicate) return prev;
      
      const newLeg: BetSlipLeg = {
        legId: crypto.randomUUID(),
        player: { ...legToDuplicate.player },
        details: {
          ...defaultLegDetails,
          oddsFormat: legToDuplicate.details.oddsFormat,
        },
      };
      
      // Insert new leg right after the duplicated one
      const index = prev.findIndex((leg) => leg.legId === legId);
      const newLegs = [...prev];
      newLegs.splice(index + 1, 0, newLeg);
      return newLegs;
    });
  }, []);

  const updateLegDetails = useCallback((legId: string, updates: Partial<LegDetails>) => {
    setLegs((prev) =>
      prev.map((leg) =>
        leg.legId === legId
          ? { ...leg, details: { ...leg.details, ...updates } }
          : leg
      )
    );
  }, []);

  const isPlayerInSlip = useCallback((id: string) => {
    return legs.some((leg) => leg.player.id === id);
  }, [legs]);

  const clearSlip = useCallback(() => {
    setLegs([]);
  }, []);

  // Legacy support: get unique players from legs
  const players = React.useMemo(() => {
    const uniquePlayers = new Map<string, BetSlipPlayer>();
    legs.forEach((leg) => {
      if (!uniquePlayers.has(leg.player.id)) {
        uniquePlayers.set(leg.player.id, leg.player);
      }
    });
    return Array.from(uniquePlayers.values());
  }, [legs]);

  // Legacy support: remove all legs for a player
  const removePlayer = useCallback((id: string) => {
    setLegs((prev) => prev.filter((leg) => leg.player.id !== id));
  }, []);

  // Parlay operations
  const saveParlay = useCallback((parlayLegs: ParlayLeg[], name?: string) => {
    const newParlay: SavedParlay = {
      id: crypto.randomUUID(),
      name: name || `Parlay ${new Date().toLocaleDateString()}`,
      legs: parlayLegs,
      createdAt: new Date().toISOString(),
    };
    
    setParlays((prev) => {
      const updated = [newParlay, ...prev];
      saveParlaysToStorage(updated);
      return updated;
    });
  }, []);

  const deleteParlay = useCallback((parlayId: string) => {
    setParlays((prev) => {
      const updated = prev.filter((p) => p.id !== parlayId);
      saveParlaysToStorage(updated);
      return updated;
    });
  }, []);

  const clearParlays = useCallback(() => {
    setParlays([]);
    saveParlaysToStorage([]);
  }, []);

  return (
    <BetSlipContext.Provider
      value={{
        legs,
        addPlayer,
        removeLeg,
        duplicateLeg,
        updateLegDetails,
        isPlayerInSlip,
        clearSlip,
        players,
        removePlayer,
        parlays,
        saveParlay,
        deleteParlay,
        clearParlays,
      }}
    >
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
