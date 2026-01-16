import sqlite3

def show_simple_relationship():
    """Simple database relationship display"""
    print("NBA Database Relationship Summary")
    print("=" * 50)
    
    try:
        # Connect to players database
        conn = sqlite3.connect('nba_players.db')
        cursor = conn.cursor()
        
        # Count players by team
        cursor.execute("""
            SELECT team_name, COUNT(*) as player_count
            FROM players 
            GROUP BY team_name
        """)
        
        team_counts = cursor.fetchall()
        
        print(f"\nPlayers by Team:")
        for team_name, player_count in sorted(team_counts):
            print(f"  {team_name:20}: {player_count:2d} players")
        
        # Total counts
        cursor.execute("SELECT COUNT(*) FROM players")
        total_players = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT team_name) FROM players")
        unique_teams = cursor.fetchone()[0]
        
        print(f"\nSummary:")
        print(f"  Total players: {total_players}")
        print(f"  Teams with players: {unique_teams}")
        
        conn.close()
        
    except Exception as e:
        print(f"✗ Error: {e}")

def main():
    """Main function"""
    show_simple_relationship()

if __name__ == "__main__":
    main()
