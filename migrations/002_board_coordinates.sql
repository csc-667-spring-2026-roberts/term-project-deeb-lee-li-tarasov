ALTER TABLE board_positions ADD COLUMN IF NOT EXISTS x INTEGER;
ALTER TABLE board_positions ADD COLUMN IF NOT EXISTS y INTEGER;
ALTER TABLE board_positions ALTER COLUMN room DROP NOT NULL;

ALTER TABLE game_turns ADD COLUMN IF NOT EXISTS moved_to_x INTEGER;
ALTER TABLE game_turns ADD COLUMN IF NOT EXISTS moved_to_y INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'game_turns_game_id_turn_number_unique'
  ) THEN
    ALTER TABLE game_turns ADD CONSTRAINT game_turns_game_id_turn_number_unique UNIQUE (game_id, turn_number);
  END IF;
END $$;

ALTER TABLE games ADD COLUMN IF NOT EXISTS current_turn_player_id INTEGER REFERENCES game_players(id);
