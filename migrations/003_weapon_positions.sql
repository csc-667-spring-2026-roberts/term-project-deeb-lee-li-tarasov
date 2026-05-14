CREATE TABLE IF NOT EXISTS weapon_positions (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id),
  weapon_card_id INTEGER NOT NULL REFERENCES cards(id),
  room_card_id INTEGER NOT NULL REFERENCES cards(id),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (game_id, weapon_card_id)
);
