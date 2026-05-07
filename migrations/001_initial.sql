CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR NOT NULL UNIQUE,
  email VARCHAR NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  stats_wins INTEGER NOT NULL DEFAULT 0,
  stats_losses INTEGER NOT NULL DEFAULT 0,
  stats_games_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  type VARCHAR NOT NULL,
  name VARCHAR NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  status VARCHAR NOT NULL DEFAULT 'lobby',
  max_players INTEGER NOT NULL DEFAULT 6,
  created_by INTEGER NOT NULL REFERENCES users(id),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  winner_user_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS game_players (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  character VARCHAR NOT NULL,
  turn_order INTEGER NOT NULL,
  is_eliminated BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_solutions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL UNIQUE REFERENCES games(id),
  suspect_card_id INTEGER NOT NULL REFERENCES cards(id),
  weapon_card_id INTEGER NOT NULL REFERENCES cards(id),
  room_card_id INTEGER NOT NULL REFERENCES cards(id)
);

CREATE TABLE IF NOT EXISTS game_player_cards (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL REFERENCES game_players(id),
  card_id INTEGER NOT NULL REFERENCES cards(id)
);

CREATE TABLE IF NOT EXISTS board_positions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL UNIQUE REFERENCES game_players(id),
  room VARCHAR NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_turns (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL REFERENCES game_players(id),
  turn_number INTEGER NOT NULL,
  dice_roll_1 INTEGER,
  dice_roll_2 INTEGER,
  moved_to_room VARCHAR,
  action_type VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suggestions (
  id SERIAL PRIMARY KEY,
  turn_id INTEGER NOT NULL UNIQUE REFERENCES game_turns(id),
  game_id INTEGER NOT NULL REFERENCES games(id),
  suggesting_player_id INTEGER NOT NULL REFERENCES game_players(id),
  suspect_card_id INTEGER NOT NULL REFERENCES cards(id),
  weapon_card_id INTEGER NOT NULL REFERENCES cards(id),
  room_card_id INTEGER NOT NULL REFERENCES cards(id)
);

CREATE TABLE IF NOT EXISTS suggestion_responses (
  id SERIAL PRIMARY KEY,
  suggestion_id INTEGER NOT NULL REFERENCES suggestions(id),
  responding_player_id INTEGER NOT NULL REFERENCES game_players(id),
  card_shown_id INTEGER REFERENCES cards(id),
  response_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accusations (
  id SERIAL PRIMARY KEY,
  turn_id INTEGER NOT NULL UNIQUE REFERENCES game_turns(id),
  game_id INTEGER NOT NULL REFERENCES games(id),
  accusing_player_id INTEGER NOT NULL REFERENCES game_players(id),
  suspect_card_id INTEGER NOT NULL REFERENCES cards(id),
  weapon_card_id INTEGER NOT NULL REFERENCES cards(id),
  room_card_id INTEGER NOT NULL REFERENCES cards(id),
  is_correct BOOLEAN NOT NULL,
  resolved_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_notes (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL REFERENCES game_players(id),
  card_id INTEGER NOT NULL REFERENCES cards(id),
  status VARCHAR NOT NULL DEFAULT 'unknown',
  noted_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO cards (type, name) VALUES
  ('suspect', 'Miss Scarlett'),
  ('suspect', 'Colonel Mustard'),
  ('suspect', 'Mrs. White'),
  ('suspect', 'Reverend Green'),
  ('suspect', 'Mrs. Peacock'),
  ('suspect', 'Professor Plum'),
  ('weapon', 'Candlestick'),
  ('weapon', 'Knife'),
  ('weapon', 'Lead Pipe'),
  ('weapon', 'Revolver'),
  ('weapon', 'Rope'),
  ('weapon', 'Wrench'),
  ('room', 'Kitchen'),
  ('room', 'Ballroom'),
  ('room', 'Conservatory'),
  ('room', 'Billiard Room'),
  ('room', 'Library'),
  ('room', 'Study'),
  ('room', 'Hall'),
  ('room', 'Lounge'),
  ('room', 'Dining Room')
ON CONFLICT (name) DO NOTHING;
