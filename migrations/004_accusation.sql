ALTER TABLE games ADD COLUMN IF NOT EXISTS winner_player_id INTEGER REFERENCES game_players(id);
