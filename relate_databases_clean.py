import sqlite3

def show_database_relationship():
    """Show relationship between players and teams databases"""
    print("NBA Database Relationship Analysis")
    print("=" * 60)
    
    try:
        # Connect to both databases
        players_conn = sqlite3.connect('nba_players.db')
        teams_conn = sqlite3.connect('nba_teams.db')
        
        players_cursor = players_conn.cursor()
        teams_cursor = teams_conn.cursor()
        
        print("\nDatabase Connection Status:")
        print(f"✓ Players database: nba_players.db")
        print(f"✓ Teams database: nba_teams.db")
        
        # Get all players with their team names
        players_cursor.execute("""
            SELECT full_name, team_name, COUNT(*) as count
            FROM players 
            GROUP BY team_name
            ORDER BY team_name
        """)
        
        player_teams = players_cursor.fetchall()
        print(f"\nFound {len(player_teams)} unique teams with players")
        
        # Get all teams
        teams_cursor.execute("SELECT team_id, name FROM teams ORDER BY name")
        all_teams = teams_cursor.fetchall()
        
        print(f"\nTeam Relationships:")
        print("-" * 60)
        
        for team_name, player_count in player_teams:
            print(f"  {team_name:25}: {player_count:2d} players")
        
        print(f"\n{'='*60}")
        print("Summary:")
        print(f"  Total unique teams with players: {len(player_teams)}")
        print(f"  Total players in database: {sum(count for _, count in player_teams)}")
        print(f"  Teams database contains: {len(all_teams)} teams")
        
        players_conn.close()
        teams_conn.close()
        
    except Exception as e:
        print(f"✗ Error relating databases: {e}")

def main():
    """Main function"""
    show_database_relationship()

if __name__ == "__main__":
    main()
