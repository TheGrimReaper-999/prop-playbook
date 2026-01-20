import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { GameLogEntry } from '@/hooks/useNbaApi';
import { StatValues } from '@/hooks/usePlayerStats';
import { supabase } from '@/integrations/supabase/client';

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

export interface LegStats {
  legId: string;
  games: GameLogEntry[];
  statValues: StatValues;
  error?: string;
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
  taken?: boolean;
  // Target game for this bet - links to nba_fixtures.event_id
  eventId?: string;
  // Prediction metadata for error tracking
  predictedMean?: number;
  predictedSigma?: number;
  pOverModel?: number;
  pUnderModel?: number;
  // Confidence and advanced model info
  confidence?: string;
  usedAdvancedModel?: boolean;
}

export interface SavedParlay {
  id: string;
  name: string;
  legs: ParlayLeg[];
  createdAt: string;
  pnl?: number | null;
  usedAdvancedModel?: boolean;
}

interface BetSlipContextType {
  legs: BetSlipLeg[];
  legStats: Map<string, LegStats>;
  addPlayer: (player: BetSlipPlayer) => void;
  removeLeg: (legId: string) => void;
  duplicateLeg: (legId: string) => void;
  updateLegDetails: (legId: string, details: Partial<LegDetails>) => void;
  setLegStats: (stats: Map<string, LegStats>) => void;
  isPlayerInSlip: (id: string, name?: string) => boolean;
  clearSlip: () => void;
  // Legacy support for player-based operations
  players: BetSlipPlayer[];
  removePlayer: (id: string, name?: string) => void;
  // Parlay operations
  parlays: SavedParlay[];
  parlaysLoading: boolean;
  saveParlay: (legs: ParlayLeg[], name?: string) => Promise<void>;
  deleteParlay: (parlayId: string) => Promise<void>;
  renameParlay: (parlayId: string, newName: string) => Promise<void>;
  updateParlayPnl: (parlayId: string, pnl: number | null) => Promise<void>;
  updateParlayLegs: (parlayId: string, legs: ParlayLeg[]) => Promise<void>;
  clearParlays: () => void;
  refreshParlays: () => Promise<void>;
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

export const BetSlipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [legs, setLegs] = useState<BetSlipLeg[]>([]);
  const [legStats, setLegStats] = useState<Map<string, LegStats>>(new Map());
  const [parlays, setParlays] = useState<SavedParlay[]>([]);
  const [parlaysLoading, setParlaysLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch parlays from database when authenticated
  const fetchParlays = useCallback(async () => {
    if (!session) {
      setParlays([]);
      setParlaysLoading(false);
      return;
    }

    try {
      setParlaysLoading(true);
      const { data, error } = await supabase.functions.invoke('parlays', {
        method: 'GET',
      });

      if (error) {
        console.error('Error fetching parlays:', error);
        setParlays([]);
        return;
      }

      // Transform database format to app format (be defensive about JSON column shapes)
      const transformedParlays: SavedParlay[] = (data || []).map((p: {
        id: string;
        name: string;
        legs: unknown;
        created_at: string;
        pnl?: number | null;
      }) => ({
        id: p.id,
        name: p.name,
        legs: Array.isArray(p.legs) ? (p.legs as ParlayLeg[]) : [],
        createdAt: p.created_at,
        pnl: p.pnl,
      }));

      setParlays(transformedParlays);
    } catch (err) {
      console.error('Error fetching parlays:', err);
      setParlays([]);
    } finally {
      setParlaysLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchParlays();
  }, [fetchParlays]);

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

  const isPlayerInSlip = useCallback((id: string, name?: string) => {
    return legs.some((leg) => 
      leg.player.id === id || 
      (name && leg.player.name.toLowerCase() === name.toLowerCase())
    );
  }, [legs]);

  const clearSlip = useCallback(() => {
    setLegs([]);
    setLegStats(new Map());
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

  // Legacy support: remove all legs for a player (by ID or name)
  const removePlayer = useCallback((id: string, name?: string) => {
    setLegs((prev) => prev.filter((leg) => 
      leg.player.id !== id && 
      !(name && leg.player.name.toLowerCase() === name.toLowerCase())
    ));
  }, []);

  // Parlay operations - now using database
  const saveParlay = useCallback(async (parlayLegs: ParlayLeg[], name?: string) => {
    // Mark all legs as taken by default
    const legsWithTaken = parlayLegs.map(leg => ({ ...leg, taken: leg.taken ?? true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('parlays', {
        method: 'POST',
        body: {
          name: name || `Parlay ${new Date().toLocaleDateString()}`,
          legs: legsWithTaken,
        },
      });

      if (error) {
        console.error('Error saving parlay:', error);
        throw error;
      }

      // Add to local state
      const newParlay: SavedParlay = {
        id: data.id,
        name: data.name,
        legs: Array.isArray(data.legs) ? (data.legs as ParlayLeg[]) : parlayLegs,
        createdAt: data.created_at,
      };

      setParlays((prev) => [newParlay, ...prev]);

      // Store predictions for error tracking (fire and forget)
      if (session?.user?.id) {
        const predictions = parlayLegs
          .filter(leg => leg.predictedMean !== undefined)
          .map(leg => ({
            user_id: session.user.id,
            parlay_id: data.id,
            player_id: leg.player.id,
            player_name: leg.player.name,
            stat_type: leg.statType,
            prop_line: parseFloat(leg.mainLine),
            predicted_mean: leg.predictedMean,
            predicted_sigma: leg.predictedSigma,
            p_over_model: leg.pOverModel,
            p_under_model: leg.pUnderModel,
            decision: leg.decision,
          }));

        if (predictions.length > 0) {
          supabase.from('predictions').insert(predictions).then(({ error: predError }) => {
            if (predError) {
              console.error('Error storing predictions:', predError);
            } else {
              console.log(`[BetSlipContext] Stored ${predictions.length} predictions for error tracking`);
            }
          });
        }
      }
    } catch (err) {
      console.error('Error saving parlay:', err);
      throw err;
    }
  }, [session]);

  const deleteParlay = useCallback(async (parlayId: string) => {
    try {
      // Some fetch implementations don't reliably support DELETE bodies.
      // We route deletes through POST + action to avoid transport issues.
      const { error } = await supabase.functions.invoke('parlays', {
        method: 'POST',
        body: { action: 'delete', id: parlayId },
      });

      if (error) {
        console.error('Error deleting parlay:', error);
        throw error;
      }

      setParlays((prev) => prev.filter((p) => p.id !== parlayId));
    } catch (err) {
      console.error('Error deleting parlay:', err);
      throw err;
    }
  }, []);

  const renameParlay = useCallback(async (parlayId: string, newName: string) => {
    try {
      // POST workaround (some environments block PUT requests)
      const { error } = await supabase.functions.invoke('parlays', {
        method: 'POST',
        body: { action: 'update', id: parlayId, name: newName },
      });

      if (error) {
        console.error('Error renaming parlay:', error);
        throw error;
      }

      setParlays((prev) =>
        prev.map((p) => (p.id === parlayId ? { ...p, name: newName } : p))
      );
    } catch (err) {
      console.error('Error renaming parlay:', err);
      throw err;
    }
  }, []);

  const updateParlayPnl = useCallback(async (parlayId: string, pnl: number | null) => {
    try {
      // POST workaround (some environments block PUT requests)
      const { error } = await supabase.functions.invoke('parlays', {
        method: 'POST',
        body: { action: 'update', id: parlayId, pnl },
      });

      if (error) {
        console.error('Error updating parlay PnL:', error);
        throw error;
      }

      setParlays((prev) =>
        prev.map((p) => (p.id === parlayId ? { ...p, pnl } : p))
      );
    } catch (err) {
      console.error('Error updating parlay PnL:', err);
      throw err;
    }
  }, []);

  const updateParlayLegs = useCallback(async (parlayId: string, updatedLegs: ParlayLeg[]) => {
    try {
      // POST workaround (some environments block PUT requests)
      const { error } = await supabase.functions.invoke('parlays', {
        method: 'POST',
        body: { action: 'update', id: parlayId, legs: updatedLegs },
      });

      if (error) {
        console.error('Error updating parlay legs:', error);
        throw error;
      }

      setParlays((prev) =>
        prev.map((p) => (p.id === parlayId ? { ...p, legs: updatedLegs } : p))
      );
    } catch (err) {
      console.error('Error updating parlay legs:', err);
      throw err;
    }
  }, []);

  const clearParlays = useCallback(() => {
    setParlays([]);
  }, []);

  return (
    <BetSlipContext.Provider
      value={{
        legs,
        legStats,
        addPlayer,
        removeLeg,
        duplicateLeg,
        updateLegDetails,
        setLegStats,
        isPlayerInSlip,
        clearSlip,
        players,
        removePlayer,
        parlays,
        parlaysLoading,
        saveParlay,
        deleteParlay,
        renameParlay,
        updateParlayPnl,
        updateParlayLegs,
        clearParlays,
        refreshParlays: fetchParlays,
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