-- CLUEDO ONLINE - Database Schema
-- Generated from DBML specification

-- =============================================
-- TABLES
-- =============================================

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR NOT NULL UNIQUE,
  email VARCHAR NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  stats_wins INTEGER NOT NULL DEFAULT 0,
  stats_losses INTEGER NOT NULL DEFAULT 0,
  stats_games_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE cards (
  id SERIAL PRIMARY KEY,
  type VARCHAR NOT NULL,        -- suspect | weapon | room
  name VARCHAR NOT NULL UNIQUE  -- e.g. Miss Scarlett, Lead Pipe, Kitchen
);

CREATE TABLE games (
  id SERIAL PRIMARY KEY,
  status VARCHAR NOT NULL DEFAULT 'lobby',
  max_players INTEGER NOT NULL DEFAULT 6,
  created_by INTEGER NOT NULL REFERENCES users(id),
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  winner_user_id INTEGER REFERENCES users(id),
  current_turn_player_id INTEGER REFERENCES game_players(id)
);

CREATE TABLE game_players (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  character VARCHAR NOT NULL,     -- Scarlett | Mustard | Plum | Peacock | Green | White
  turn_order INTEGER NOT NULL,    -- 1–6, unique within a game
  is_eliminated BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE game_solutions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL UNIQUE REFERENCES games(id),  -- exactly one solution per game
  suspect_card_id INTEGER NOT NULL REFERENCES cards(id),
  weapon_card_id INTEGER NOT NULL REFERENCES cards(id),
  room_card_id INTEGER NOT NULL REFERENCES cards(id)
);

CREATE TABLE game_player_cards (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL REFERENCES game_players(id),
  card_id INTEGER NOT NULL REFERENCES cards(id)
);

CREATE TABLE board_positions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL UNIQUE REFERENCES game_players(id),
  x INTEGER,
  y INTEGER,
  room VARCHAR,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE game_turns (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL REFERENCES game_players(id),
  turn_number INTEGER NOT NULL,
  dice_roll_1 INTEGER,
  dice_roll_2 INTEGER,
  moved_to_room VARCHAR,
  moved_to_x INTEGER,
  moved_to_y INTEGER,
  action_type VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (game_id, turn_number)
);

CREATE TABLE suggestions (
  id SERIAL PRIMARY KEY,
  turn_id INTEGER NOT NULL UNIQUE REFERENCES game_turns(id),
  game_id INTEGER NOT NULL REFERENCES games(id),
  suggesting_player_id INTEGER NOT NULL REFERENCES game_players(id),
  suspect_card_id INTEGER NOT NULL REFERENCES cards(id),
  weapon_card_id INTEGER NOT NULL REFERENCES cards(id),
  room_card_id INTEGER NOT NULL REFERENCES cards(id)
);

CREATE TABLE suggestion_responses (
  id SERIAL PRIMARY KEY,
  suggestion_id INTEGER NOT NULL REFERENCES suggestions(id),
  responding_player_id INTEGER NOT NULL REFERENCES game_players(id),
  card_shown_id INTEGER REFERENCES cards(id),  -- null = player could not disprove
  response_order INTEGER NOT NULL               -- 1 = first clockwise player
);

CREATE TABLE accusations (
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

CREATE TABLE player_notes (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  player_id INTEGER NOT NULL REFERENCES game_players(id),
  card_id INTEGER NOT NULL REFERENCES cards(id),
  status VARCHAR NOT NULL DEFAULT 'unknown',
  noted_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE weapon_positions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  weapon_card_id INTEGER NOT NULL REFERENCES cards(id),
  room_card_id INTEGER NOT NULL REFERENCES cards(id),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (game_id, weapon_card_id)
);

-- =============================================
-- SEED DATA: The 21 fixed Cluedo cards
-- =============================================

-- 6 Suspects
INSERT INTO cards (type, name) VALUES
  ('suspect', 'Miss Scarlett'),
  ('suspect', 'Colonel Mustard'),
  ('suspect', 'Mrs. White'),
  ('suspect', 'Reverend Green'),
  ('suspect', 'Mrs. Peacock'),
  ('suspect', 'Professor Plum');

-- 6 Weapons
INSERT INTO cards (type, name) VALUES
  ('weapon', 'Candlestick'),
  ('weapon', 'Knife'),
  ('weapon', 'Lead Pipe'),
  ('weapon', 'Revolver'),
  ('weapon', 'Rope'),
  ('weapon', 'Wrench');

-- 9 Rooms
INSERT INTO cards (type, name) VALUES
  ('room', 'Kitchen'),
  ('room', 'Ballroom'),
  ('room', 'Conservatory'),
  ('room', 'Billiard Room'),
  ('room', 'Library'),
  ('room', 'Study'),
  ('room', 'Hall'),
  ('room', 'Lounge'),
  ('room', 'Dining Room');
