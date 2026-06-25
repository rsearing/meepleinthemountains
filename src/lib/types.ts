export type Role = "admin" | "attendee";
export type EventStatus = "draft" | "upcoming" | "active" | "completed" | "cancelled";

export type Profile = {
  id: string;
  auth_user_id: string | null;
  owner_profile_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  role: Role;
  phone: string | null;
  admin_notes: string | null;
  shirt_size_id: string | null;
  allergies: string[];
  drink_preferences: string[];
  snack_preferences: string[];
  food_preferences: string[];
  comments: string | null;
};

export type EventRecord = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  description: string;
  status: EventStatus;
};

export type EventImage = {
  id: string;
  event_id: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
};

export type ShirtSize = {
  id: string;
  label: string;
  sort_order: number;
  active: boolean;
};

export type EventBed = {
  id: string;
  event_id: string;
  name: string;
  bed_type: string | null;
  capacity: number;
  sort_order: number;
};

export type EventAttendee = {
  id: string;
  event_id: string;
  profile_id: string;
  shirt_size_id: string | null;
  food_allergies: string | null;
  food_preferences: string | null;
  bed_id: string | null;
};

export type GameEntry = {
  id: string;
  event_id: string;
  profile_id: string;
  title: string;
  notes: string | null;
};
