// NBA Team name to abbreviation mapping
export const NBA_TEAM_ABBREVS: Record<string, string> = {
  'atlanta hawks': 'ATL',
  'boston celtics': 'BOS',
  'brooklyn nets': 'BKN',
  'charlotte hornets': 'CHA',
  'chicago bulls': 'CHI',
  'cleveland cavaliers': 'CLE',
  'dallas mavericks': 'DAL',
  'denver nuggets': 'DEN',
  'detroit pistons': 'DET',
  'golden state warriors': 'GSW',
  'houston rockets': 'HOU',
  'indiana pacers': 'IND',
  'los angeles clippers': 'LAC',
  'la clippers': 'LAC',
  'los angeles lakers': 'LAL',
  'la lakers': 'LAL',
  'memphis grizzlies': 'MEM',
  'miami heat': 'MIA',
  'milwaukee bucks': 'MIL',
  'minnesota timberwolves': 'MIN',
  'new orleans pelicans': 'NOP',
  'new york knicks': 'NYK',
  'oklahoma city thunder': 'OKC',
  'orlando magic': 'ORL',
  'philadelphia 76ers': 'PHI',
  'phoenix suns': 'PHX',
  'portland trail blazers': 'POR',
  'sacramento kings': 'SAC',
  'san antonio spurs': 'SA',
  'toronto raptors': 'TOR',
  'utah jazz': 'UTAH',
  'washington wizards': 'WAS',
};

// Reverse mapping from abbreviation to full name
export const ABBREV_TO_TEAM: Record<string, string> = Object.entries(NBA_TEAM_ABBREVS).reduce(
  (acc, [name, abbrev]) => {
    acc[abbrev.toLowerCase()] = name;
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Get the abbreviation for a team name
 */
export const getTeamAbbrev = (teamName: string): string | null => {
  const normalized = teamName.toLowerCase().trim();
  
  // Direct match
  if (NBA_TEAM_ABBREVS[normalized]) {
    return NBA_TEAM_ABBREVS[normalized];
  }
  
  // Check if it's already an abbreviation
  if (ABBREV_TO_TEAM[normalized]) {
    return normalized.toUpperCase();
  }
  
  // Partial match (e.g., "Spurs" matches "San Antonio Spurs")
  for (const [name, abbrev] of Object.entries(NBA_TEAM_ABBREVS)) {
    if (name.includes(normalized) || normalized.includes(name.split(' ').pop()!)) {
      return abbrev;
    }
  }
  
  return null;
};

/**
 * Check if a team name matches a given abbreviation
 * Handles full team names, partial names, and abbreviations
 */
export const teamMatchesAbbrev = (teamName: string, abbrev: string | null): boolean => {
  if (!abbrev || !teamName) return false;
  
  const normalizedTeam = teamName.toLowerCase().trim();
  const normalizedAbbrev = abbrev.toLowerCase().trim();
  
  // Direct abbreviation match
  if (normalizedTeam === normalizedAbbrev) {
    return true;
  }
  
  // Get the abbreviation for the team name and compare
  const teamAbbrev = getTeamAbbrev(normalizedTeam);
  if (teamAbbrev && teamAbbrev.toLowerCase() === normalizedAbbrev) {
    return true;
  }
  
  // Check if the team name is actually an abbreviation that matches
  if (ABBREV_TO_TEAM[normalizedTeam] && normalizedTeam === normalizedAbbrev) {
    return true;
  }
  
  return false;
};
