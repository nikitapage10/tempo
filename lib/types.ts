export type TrackType = "original" | "remix" | "edit" | "collab" | "bootleg";

export type Momentum = "active" | "simmering" | "stalled" | "parked";

export type Space = {
  id: string;
  user_id: string;
  name: string;
  sort: number;
  accent_color: string | null;
  created_at: string;
};

export type Stage = {
  id: string;
  space_id: string;
  name: string;
  sort: number;
  color: string | null;
  created_at: string;
};

export type Track = {
  id: string;
  user_id: string;
  space_id: string;
  project_id: string | null;
  stage_id: string | null;
  title: string;
  artist_alias: string | null;
  type: TrackType;
  bpm: number | null;
  musical_key: string | null;
  genre: string | null;
  destination: string | null;
  deadline: string | null;
  momentum: Momentum;
  tags: string[];
  notes: string | null;
  artwork_url: string | null;
  created_at: string;
  updated_at: string;
};

export type TrackInsert = {
  space_id: string;
  stage_id: string | null;
  title: string;
  type: TrackType;
  artist_alias?: string | null;
  bpm?: number | null;
  musical_key?: string | null;
  genre?: string | null;
  destination?: string | null;
  deadline?: string | null;
  momentum?: Momentum;
  tags?: string[];
  notes?: string | null;
};

export type TrackUpdate = Partial<
  Omit<TrackInsert, "space_id"> & { space_id?: string; updated_at?: string }
>;
