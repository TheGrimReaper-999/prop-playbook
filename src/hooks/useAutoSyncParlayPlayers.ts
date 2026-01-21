import { useCallback, useEffect, useRef, useState } from 'react';
import { SavedParlay } from '@/contexts/BetSlipContext';
import { ParlayResult } from '@/hooks/useParlayStatus';
import { ensurePlayerStats } from '@/hooks/usePlayerStats';

interface PlayerToSync {
  playerId: string;
  playerName: string;
  teamName?: string;
}

// Process items in batches with concurrency control
const processBatch = async <T,>(
  items: T[],
  processor: (item: T) => Promise<void>,
  concurrency: number = 3
): Promise<void> => {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.allSettled(batch.map(processor));
  }
};

/**
 * Auto-syncs player stats for pending parlay legs when the Parlays page loads.
 * Only syncs players whose games have finished (game date > 3 hours ago).
 * Also provides a manual refresh function.
 */
export const useAutoSyncParlayPlayers = (
  parlays: SavedParlay[],
  parlayStatusData: Map<string, ParlayResult> | undefined,
  refetchParlayStatus: () => void
) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const syncedPlayersRef = useRef<Set<string>>(new Set());
  const hasSyncedRef = useRef(false);

  const findPlayersNeedingSync = useCallback((forceAll: boolean = false): PlayerToSync[] => {
    if (!parlayStatusData) return [];
    
    const playersToSync = new Map<string, PlayerToSync>();
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    for (const parlay of parlays) {
      const parlayResult = parlayStatusData.get(parlay.id);
      if (!parlayResult) continue;

      for (const leg of parlay.legs) {
        const legResult = parlayResult.legResults.find(l => l.legId === leg.legId);
        if (!legResult) continue;

        // Skip if already has result
        if (legResult.status !== 'pending') continue;

        // For manual refresh, don't require eventId (will attempt to link)
        // For auto-sync, require eventId
        if (!forceAll && !leg.eventId) continue;

        // Skip if already synced this session (unless forced)
        if (!forceAll && syncedPlayersRef.current.has(leg.player.id)) continue;

        // Check if game date is in the past (finished) - only for auto-sync
        if (!forceAll) {
          const gameDate = legResult.gameDate ? new Date(legResult.gameDate) : null;
          if (!gameDate || gameDate > threeHoursAgo) continue;
        }

        // Add player to sync list
        playersToSync.set(leg.player.id, {
          playerId: leg.player.id,
          playerName: leg.player.name,
          teamName: leg.player.team,
        });
      }
    }

    return Array.from(playersToSync.values());
  }, [parlays, parlayStatusData]);

  const syncPlayers = useCallback(async (players: PlayerToSync[], markSynced: boolean = true) => {
    if (players.length === 0) return;

    console.log(`[useAutoSyncParlayPlayers] Syncing ${players.length} players...`);
    setIsSyncing(true);

    try {
      await processBatch(
        players,
        async (player) => {
          try {
            console.log(`[useAutoSyncParlayPlayers] Syncing ${player.playerName}...`);
            await ensurePlayerStats(player.playerId, player.playerName, player.teamName);
            if (markSynced) {
              syncedPlayersRef.current.add(player.playerId);
            }
          } catch (err) {
            console.error(`[useAutoSyncParlayPlayers] Failed to sync ${player.playerName}:`, err);
          }
        },
        3 // Process 3 players at a time
      );

      // Refetch parlay statuses after sync
      console.log('[useAutoSyncParlayPlayers] Sync complete, refetching statuses...');
      refetchParlayStatus();
    } finally {
      setIsSyncing(false);
    }
  }, [refetchParlayStatus]);

  // Auto-sync on mount
  useEffect(() => {
    if (!parlayStatusData || hasSyncedRef.current) return;
    if (parlays.length === 0) return;

    const players = findPlayersNeedingSync(false);
    if (players.length === 0) {
      hasSyncedRef.current = true;
      return;
    }

    syncPlayers(players, true).then(() => {
      hasSyncedRef.current = true;
    });
  }, [parlays, parlayStatusData, findPlayersNeedingSync, syncPlayers]);

  // Manual refresh function - syncs ALL pending players
  const refreshAll = useCallback(async () => {
    if (isSyncing) return;
    const players = findPlayersNeedingSync(true);
    await syncPlayers(players, false);
  }, [isSyncing, findPlayersNeedingSync, syncPlayers]);

  return { isSyncing, refreshAll };
};
