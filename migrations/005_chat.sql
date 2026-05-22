CREATE TABLE IF NOT EXISTS game_messages (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL REFERENCES game_players(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
