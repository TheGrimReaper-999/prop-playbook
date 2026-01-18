import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from './useDebounce';

export interface SearchResult {
  id: string;
  name: string;
  type: 'player' | 'team';
  teamName?: string;
  imageUrl?: string;
}

export const useAutocomplete = (query: string) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const searchTerm = `%${debouncedQuery}%`;

        // Fetch players and teams in parallel
        const [playersResponse, teamsResponse] = await Promise.all([
          supabase
            .from('nba_players')
            .select('id, full_name, team_name, image_url')
            .ilike('full_name', searchTerm)
            .limit(5),
          supabase
            .from('nba_teams')
            .select('id, name, logo_url')
            .ilike('name', searchTerm)
            .limit(3),
        ]);

        const players: SearchResult[] = (playersResponse.data || []).map((p) => ({
          id: p.id,
          name: p.full_name,
          type: 'player' as const,
          teamName: p.team_name,
          imageUrl: p.image_url ?? undefined,
        }));

        const teams: SearchResult[] = (teamsResponse.data || []).map((t) => ({
          id: t.id,
          name: t.name,
          type: 'team' as const,
          imageUrl: t.logo_url ?? undefined,
        }));

        setResults([...players, ...teams]);
      } catch (error) {
        console.error('Autocomplete error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

  return { results, isLoading };
};
