ALTER TABLE board_positions ADD COLUMN IF NOT EXISTS track_pos INTEGER;
ALTER TABLE game_turns ADD COLUMN IF NOT EXISTS moved_to_track_pos INTEGER;
