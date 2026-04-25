/** Shared client/server-facing record shapes returned by the JSON API. */

export interface Camera {
  id: number
  client_id: string | null
  name: string
  format: '135' | '120' | '4x5' | '8x10' | 'other'
  has_interchangeable_back: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Lens {
  id: number
  client_id: string | null
  name: string
  focal_length_mm: number
  max_aperture: number | null
  min_aperture: number | null
  mount: string | null
  notes: string | null
  created_at: string
  updated_at: string
  camera_ids?: number[]
}

export interface Lab {
  id: number
  client_id: string | null
  name: string
  address: string | null
  phone: string | null
  website: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Roll {
  id: number
  client_id: string | null
  camera_id: number
  film_stock: string
  iso: number
  box_speed: number | null
  frame_count: number
  status: 'loaded' | 'finished' | 'archived'
  loaded_at: string
  finished_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RollListItem extends Roll {
  camera_name: string
  shot_count: number
  latest_development_status: string | null
}

export interface RollDetailRoll extends Roll {
  camera_name: string
  camera_format: string
}

export interface Shot {
  id: number
  client_id: string | null
  roll_id?: number
  frame_number: number | null
  taken_at: string
  lens_id: number | null
  lens_name?: string | null
  aperture: number | null
  shutter_speed: string | null
  location_text: string | null
  latitude: number | null
  longitude: number | null
  location_accuracy_m: number | null
  notes: string | null
}

export interface Development {
  id: number
  lab_id: number | null
  lab_name: string | null
  status: 'dropped_off' | 'in_progress' | 'delivered' | 'cancelled'
  dropped_off_at: string | null
  expected_ready_at: string | null
  delivered_at: string | null
  process: string | null
  push_pull_stops: number
  scans_requested: number
  scan_resolution: string | null
  scan_format: string | null
  cost: number | null
  currency: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
