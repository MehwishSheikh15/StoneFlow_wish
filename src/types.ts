export type PriorityLevel = 'urgent' | 'high' | 'normal' | 'low';

export interface User {
  id: string;
  name: string;
  initials: string;
  role: 'owner' | 'office' | 'factory' | 'installer';
  avatarBg: string;
  email?: string;
  password?: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface Job {
  id: string; // e.g. SF-1042
  job_name?: string;
  customer_name?: string;
  client_id: string;
  client_name: string; // De-normalized for easier display
  site_address: string;
  job_type: string;
  current_stage: number; // 1 to 17
  priority: PriorityLevel;
  client_approved_at: string | null; // ISO Date String
  assigned_to: string; // User ID
  last_activity_at: string; // ISO Date String
  next_action: string;
  value: number;
  notes: string;
  material?: string;
  slab?: string;
  job_reference?: string;
  job_description?: string;
  account_name?: string;
  account_phone?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state_territory?: string;
  postal_code?: string;
  country?: string;
  templated_date?: string;
  pickup_location?: string;
  templated_by?: string;
  fabricated_by?: string;
  installed_by?: string;
  template_date?: string;
  fabrication_date?: string;
  install_date?: string;
  total_area?: string;
  piece_counts?: string;
  primary_edge_style?: string;
  wall_lm?: string;
  flat_polish_lm?: string;
  splashback_lm?: string;
  mitered_lm?: string;
  front_fascia_lm?: string;
  miter_lm?: string;
  cutouts_json?: string;
  faucet_info?: string;
  faucet_hole_diameter?: string;
  faucet_quantity?: string;
  faucet_drilled_onsite?: string;
  software_system?: string;
}

export interface JobStatusHistory {
  id: string;
  job_id: string;
  old_stage: number;
  new_stage: number;
  changed_by: string; // User ID or Name
  changed_at: string; // ISO Date String
  notes?: string;
}

export interface Material {
  id: string;
  job_id: string;
  type: string; // Natural Stone, Engineered Stone, etc.
  color: string;
  brand: string;
  slab_id: string; // Slab name/ID
  quantity: string;
  dimensions?: string;
  supplier?: string;
  supplier_address?: string;
  material_detail?: string;
  available: boolean;
  notes?: string;
  batch?: string;
  status: 'reserved' | 'low' | 'in-use' | 'available' | 'missing';
  rack?: string;
  coordinates?: string; // e.g. "A3", "B4"
}

export interface OffCut {
  id: string;
  job_id: string;
  dimensions: string;
  quantity: string;
  type: string;
  color: string;
  slab: string;
  brand: string;
  location: string;
  status: 'available' | 'reserved' | 'used';
  notes?: string;
}

export interface Drawing {
  id: string;
  job_id: string;
  name: string;
  uploaded_at: string;
  status: 'approved' | 'awaiting' | 'rejected';
  approval_timestamp?: string;
  image_url?: string;
  signature_url?: string;
  signed_by?: string;
}

export interface JobPhoto {
  id: string;
  job_id: string;
  category: string; // 'qc' | 'site' | 'general'
  url: string; // base64 or URL path
  filename: string;
  uploaded_at: string;
}

export interface Measurement {
  id: string;
  job_id: string;
  measured_at?: string;
  measured_by?: string;
  sheet_uploaded: boolean;
  notes?: string;
}

export interface Installation {
  id: string;
  job_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: 'Scheduled' | 'On site' | 'Completed';
  installer_id: string;
  completed_at?: string;
  completion_photos?: string[];
  signature_name?: string;
  signature_svg?: string;
  notes?: string;
  installer_name?: string;
  route_order?: number;
  checklist?: Record<string, boolean>;
}

export interface Invoice {
  id: string; // Number
  job_id: string;
  amount: number;
  sent_date: string | null;
  paid_date: string | null;
  status: 'pending' | 'sent' | 'paid' | 'draft';
  docket_rows_json?: string;
  signature_name?: string;
  signature_data_url?: string;
  signed_at?: string;
  signed_by_role?: string;
  subtotal_amount?: number;
  gst_amount?: number;
  total_amount?: number;
  invoice_notes?: string;
}

export interface ActivityLog {
  id: string;
  job_id: string;
  user_id: string;
  user_name: string;
  action: string;
  timestamp: string;
}

export interface WarningItem {
  id: string;
  rule_num: number;
  title: string;
  job_id: string;
  client_name: string;
  desc: string;
  severity: 'block' | 'warn' | 'info';
  timestamp: string;
  reviewed: boolean;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  user_name: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

export interface QCRecord {
  id: string;
  job_id: string;
  client_name: string;
  inspector_name: string;
  passed_at: string;
  checks_summary: string[];
  photo_url?: string;
  material?: string;
  status: 'passed' | 'flagged';
  notes?: string;
}

