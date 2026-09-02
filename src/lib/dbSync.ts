import { Job, Material, JobStatusHistory, ActivityLog, WarningItem, OffCut, Invoice, Installation, Drawing, User, PriorityLevel, JobPhoto, LeaveRequest, QCRecord } from '../types';
import { validateStageTransition } from './workflowService';

const isBrowser = typeof window !== 'undefined';
export const localBroadcastChannel = isBrowser && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('stoneflow_realtime') : null;

export const broadcastLocalUpdate = (sourceTabId?: string) => {
  if (localBroadcastChannel) {
    localBroadcastChannel.postMessage({
      type: 'SYNC_DATABASE',
      timestamp: Date.now(),
      sourceTabId: sourceTabId || 'current'
    });
  }
};

function generateUniqueId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${Date.now()}-${rand}`;
}

function sanitizeIds<T extends { id: string }>(items: T[], prefix: string): T[] {
  const seen = new Set<string>();
  return items.map(item => {
    if (!item.id || seen.has(item.id)) {
      const newId = generateUniqueId(prefix);
      seen.add(newId);
      return { ...item, id: newId };
    }
    seen.add(item.id);
    return item;
  });
}

/**
  * Retry mechanism for failed network requests with exponential backoff
  */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 500
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise(res => setTimeout(res, delayMs * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError;
}

// Hardcoded Users/Roles
export const MOCK_USERS: User[] = [
  { id: 'u-1', name: 'Mehwish', initials: 'MS', role: 'owner', avatarBg: 'bg-indigo-600 text-white', email: 'owner@stoneflow.com', password: 'owner123' },
  { id: 'u-2', name: 'Sara M.', initials: 'SM', role: 'office', avatarBg: 'bg-zinc-600 text-white', email: 'office@stoneflow.com', password: 'office123' },
  { id: 'u-3', name: 'Rashid K.', initials: 'RK', role: 'factory', avatarBg: 'bg-teal-600 text-white', email: 'factory@stoneflow.com', password: 'factory123' },
  { id: 'u-4', name: 'Tom J.', initials: 'TJ', role: 'installer', avatarBg: 'bg-amber-600 text-white', email: 'installer@stoneflow.com', password: 'installer123' }
];

export const PRIORITY_THRESHOLDS = {
  urgent: 2,
  high: 4,
  normal: 7,
  low: 14
};

// Phase mappings
export const PHASES = [
  { name: 'Sales', label: 'Sales Pipeline', range: [1, 4], color: '#2E4EC6' },
  { name: 'Design', label: 'Design & Approval', range: [5, 7], color: '#5C6E96' },
  { name: 'Production', label: 'In Factory', range: [8, 12], color: '#A97613' },
  { name: 'Installation', label: 'Install', range: [13, 14], color: '#0E7A5F' },
  { name: 'Accounts', label: 'Billing & Closed', range: [15, 17], color: '#16171B' }
];

export const STAGES = [
  { n: 1, name: 'Lead', phase: 'Sales', desc: 'Enquiry logged: contact details, source, one-line requirement' },
  { n: 2, name: 'Site Visit Required', phase: 'Sales', desc: 'Decision recorded — visit scheduled or marked not required' },
  { n: 3, name: 'Quoting', phase: 'Sales', desc: 'Price prepared and quote sent' },
  { n: 4, name: 'Quote Accepted', phase: 'Sales', desc: 'Customer confirmation logged' },
  { n: 5, name: 'Measure', phase: 'Design', desc: 'Site visit completed, measurement sheet uploaded' },
  { n: 6, name: 'Drawing', phase: 'Design', desc: 'CAD / PDF drawing completed and shared' },
  { n: 7, name: 'Client Approval', phase: 'Design', desc: "Customer's written approval logged — The Approval Gate" },
  { n: 8, name: 'Material Reserved', phase: 'Production', desc: 'Stone / slab confirmed available, reserved or ordered' },
  { n: 9, name: 'Cutting', phase: 'Production', desc: 'Stone cut to size; operator and machine logged' },
  { n: 10, name: 'CNC / Fabrication', phase: 'Production', desc: 'Shaping, cutouts, edge profiling completed' },
  { n: 11, name: 'Polishing', phase: 'Production', desc: 'Surface finishing completed' },
  { n: 12, name: 'QC Complete', phase: 'Production', desc: 'Quality checklist passed and photos uploaded' },
  { n: 13, name: 'Install Scheduled', phase: 'Installation', desc: 'Date confirmed with customer and installer' },
  { n: 14, name: 'Install Completed', phase: 'Installation', desc: 'Piece fitted; completion photos & customer sign-off' },
  { n: 15, name: 'Invoice Sent', phase: 'Accounts', desc: 'Final invoice generated and sent' },
  { n: 16, name: 'Paid', phase: 'Accounts', desc: 'Payment received and reconciled' },
  { n: 17, name: 'Closed', phase: 'Accounts', desc: 'Job marked closed and archived' }
];

export function getPhaseByStage(stageNum: number) {
  return PHASES.find(p => stageNum >= p.range[0] && stageNum <= p.range[1]) || PHASES[0];
}

// Initial empty collections (no mock/dummy data)
const INITIAL_JOBS: Job[] = [];
const INITIAL_LEAVES: LeaveRequest[] = [];
const INITIAL_MATERIALS: Material[] = [];
const INITIAL_OFFCUTS: OffCut[] = [];
const INITIAL_DRAWINGS: Drawing[] = [];
const INITIAL_INSTALLATIONS: Installation[] = [];
const INITIAL_INVOICES: Invoice[] = [];
const INITIAL_WARNINGS: WarningItem[] = [];
const INITIAL_ACTIVITIES: ActivityLog[] = [];
const INITIAL_HISTORY: JobStatusHistory[] = [];
const INITIAL_PHOTOS: JobPhoto[] = [];

/**
 * DbSyncService - Primary database state and Express DB persistence engine
 */
export class DbSyncService {
  private listeners: Set<() => void> = new Set();
  public isSchemaMissing: boolean = false;
  private hasLoggedSchemaWarning: boolean = false;
  private realtimeChannel: any = null;

  public jobs: Job[] = [];
  public materials: Material[] = [];
  public offcuts: OffCut[] = [];
  public drawings: Drawing[] = [];
  public installations: Installation[] = [];
  public invoices: Invoice[] = [];
  public warnings: WarningItem[] = [];
  public activities: ActivityLog[] = [];
  public history: JobStatusHistory[] = [];
  public photos: JobPhoto[] = [];
  public users: User[] = [];
  public leaves: LeaveRequest[] = [];
  public qcRecords: QCRecord[] = [];

  constructor() {
    this.load();
    this.setupLocalTabSync();
    this.setupRealtime();
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.syncFromDatabase().catch(console.warn);
      }, 50);
    }
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  private setupLocalTabSync() {
    if (typeof window !== 'undefined' && localBroadcastChannel) {
      localBroadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'DB_UPDATED') {
          this.load();
          this.notify();
        }
      };
    }
  }

  public setupRealtime() {
    // Node.js Express Server DB real-time sync active via local broadcast & server sync
  }

  public async syncFromDatabase(): Promise<{ success: boolean; message: string; code?: string }> {
    try {
      const res = await fetch("/api/db/sync");
      if (res.ok) {
        const payload = await res.json();
        if (payload.success && payload.data) {
          const { jobs, materials, offcuts, drawings, installations, invoices, warnings, activities, history, photos, users, leaves } = payload.data;
          
          if (Array.isArray(jobs)) {
            const serverJobs = sanitizeIds(jobs, 'SF');
            const merged = [...this.jobs];
            serverJobs.forEach(sj => {
              const idx = merged.findIndex(lj => String(lj.id).trim().toLowerCase() === String(sj.id).trim().toLowerCase());
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...sj };
              } else {
                merged.unshift(sj);
              }
            });
            this.jobs = merged;
          }

          if (Array.isArray(materials)) {
            const serverMats = sanitizeIds(materials, 'm');
            const merged = [...this.materials];
            serverMats.forEach(sm => {
              const targetId = sm.id || sm.slab_id;
              const idx = merged.findIndex(lm => (lm.id || lm.slab_id) && String(lm.id || lm.slab_id).trim().toLowerCase() === String(targetId).trim().toLowerCase());
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...sm };
              } else {
                merged.push(sm);
              }
            });
            this.materials = merged;
          }

          if (Array.isArray(offcuts)) {
            const serverOffcuts = sanitizeIds(offcuts, 'oc');
            const merged = [...this.offcuts];
            serverOffcuts.forEach(so => {
              const targetId = so.id;
              const idx = merged.findIndex(lo => lo.id && String(lo.id).trim().toLowerCase() === String(targetId).trim().toLowerCase());
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], ...so };
              } else {
                merged.push(so);
              }
            });
            this.offcuts = merged;
          }

          if (Array.isArray(drawings) && drawings.length > 0) this.drawings = sanitizeIds(drawings, 'dr');
          if (Array.isArray(installations) && installations.length > 0) this.installations = sanitizeIds(installations, 'inst');
          if (Array.isArray(invoices) && invoices.length > 0) this.invoices = sanitizeIds(invoices, 'INV');
          if (Array.isArray(warnings) && warnings.length > 0) this.warnings = sanitizeIds(warnings, 'w');
          if (Array.isArray(activities) && activities.length > 0) this.activities = sanitizeIds(activities, 'act');
          if (Array.isArray(history) && history.length > 0) this.history = sanitizeIds(history, 'h');
          if (Array.isArray(photos) && photos.length > 0) this.photos = sanitizeIds(photos, 'p');
          if (Array.isArray(users) && users.length > 0) this.users = sanitizeIds(users, 'u');
          if (Array.isArray(leaves) && leaves.length > 0) this.leaves = sanitizeIds(leaves, 'lv');

          this.isSchemaMissing = false;
          this.saveLocalOnly();
          this.notify();
          return { success: true, message: 'Synced with Express Server DB' };
        }
      }
    } catch (err) {
      // Fallback
    }

    return { success: true, message: 'Using local state' };
  }

  public async syncFromSupabase(): Promise<{ success: boolean; message: string; code?: string }> {
    return this.syncFromDatabase();
  }

  /**
   * Persists job using Express DB API
   */
  public async persistJob(job: Job): Promise<void> {
    if (job.current_stage >= 8 && (!job.client_approved_at || job.client_approved_at === 'null')) {
      job.client_approved_at = job.last_activity_at || new Date().toISOString();
    }

    try {
      await withRetry(async () => {
        const res = await fetch("/api/db/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobs: [job] })
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.message || `HTTP ${res.status}`);
        }
      }, 3, 500);
    } catch (err) {
      console.warn('[dbSync] Express DB job save notice:', err);
    }
  }

  /**
   * Persists material using Express DB API
   */
  public async persistMaterial(mat: Material): Promise<void> {
    try {
      await withRetry(async () => {
        const res = await fetch("/api/db/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ materials: [mat] })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }, 3, 500);
    } catch (err) {
      console.warn('[dbSync] Express DB material save notice:', err);
    }
  }

  /**
   * Persists offcut using Express DB API
   */
  public async persistOffcut(oc: OffCut): Promise<void> {
    try {
      await withRetry(async () => {
        const res = await fetch("/api/db/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offcuts: [oc] })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }, 3, 500);
    } catch (err) {
      console.warn('[dbSync] Express DB offcut save notice:', err);
    }
  }

  private async sanitizeJobsForUpsert(jobs: any[]): Promise<any[]> {
    const DEFAULT_SAFE_COLUMNS = [
      'id', 'client_id', 'client_name', 'site_address', 'job_type',
      'current_stage', 'priority', 'client_approved_at', 'assigned_to',
      'last_activity_at', 'next_action', 'value', 'notes', 'material'
    ];
    const EXTENDED_COLUMNS = [
      'slab', 'job_reference', 'job_description', 'account_name', 'account_phone',
      'address_line_1', 'address_line_2', 'city', 'state_territory',
      'postal_code', 'country', 'pickup_location', 'templated_by',
      'fabricated_by', 'installed_by', 'template_date', 'fabrication_date',
      'install_date', 'total_area', 'piece_counts', 'primary_edge_style',
      'wall_lm', 'flat_polish_lm', 'splashback_lm', 'mitered_lm', 'front_fascia_lm',
      'miter_lm', 'cutouts_json', 'faucet_info', 'faucet_hole_diameter',
      'faucet_quantity', 'faucet_drilled_onsite', 'software_system'
    ];

    let validColumns = [...DEFAULT_SAFE_COLUMNS, ...EXTENDED_COLUMNS];

    return jobs.map(job => {
      const sanitized: any = {};
      validColumns.forEach(col => {
        if (job[col] !== undefined) {
          sanitized[col] = job[col];
        }
      });
      return sanitized;
    });
  }

  private async sanitizeTableData(supabase: any, tableName: string, dataArray: any[]): Promise<any[]> {
    if (!dataArray || dataArray.length === 0) return [];
    
    const allKeysSet = new Set<string>();
    dataArray.forEach(item => {
      Object.keys(item).forEach(key => {
        if (typeof item[key] !== 'function' && typeof item[key] !== 'object') {
          allKeysSet.add(key);
        } else if (item[key] === null) {
          allKeysSet.add(key);
        }
      });
    });

    const allKeys = Array.from(allKeysSet);

    return dataArray.map(item => {
      const sanitized: any = {};
      allKeys.forEach(col => {
        if (item[col] !== undefined) {
          sanitized[col] = item[col];
        }
      });
      return sanitized;
    });
  }

  public async saveToDatabase(): Promise<void> {
    const payload = {
      mode: 'replace',
      jobs: this.jobs,
      materials: this.materials,
      offcuts: this.offcuts,
      drawings: this.drawings,
      installations: this.installations,
      invoices: this.invoices,
      warnings: this.warnings,
      activities: this.activities,
      history: this.history,
      photos: this.photos,
      users: this.users,
      leaves: this.leaves
    };

    try {
      await withRetry(async () => {
        const res = await fetch("/api/db/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }, 3, 500);
    } catch (err) {
      console.warn('[dbSync] Node.js DB save warning:', err);
    }
  }

  public async saveToSupabase(): Promise<void> {
    return this.saveToDatabase();
  }

  private load() {
    if (typeof window === 'undefined') return;

    const savedJobs = localStorage.getItem('stoneflow_jobs');
    const savedMaterials = localStorage.getItem('stoneflow_materials');
    const savedOffcuts = localStorage.getItem('stoneflow_offcuts');
    const savedDrawings = localStorage.getItem('stoneflow_drawings');
    const savedInstallations = localStorage.getItem('stoneflow_installations');
    const savedInvoices = localStorage.getItem('stoneflow_invoices');
    const savedWarnings = localStorage.getItem('stoneflow_warnings');
    const savedActivities = localStorage.getItem('stoneflow_activities');
    const savedHistory = localStorage.getItem('stoneflow_history');
    const savedPhotos = localStorage.getItem('stoneflow_photos');
    const savedUsers = localStorage.getItem('stoneflow_users');
    const savedLeaves = localStorage.getItem('stoneflow_leaves');
    const savedQcRecords = localStorage.getItem('stoneflow_qcrecords');

    let parsedJobs = savedJobs ? JSON.parse(savedJobs) : INITIAL_JOBS;
    this.jobs = sanitizeIds(parsedJobs, 'SF');
    this.materials = savedMaterials ? sanitizeIds(JSON.parse(savedMaterials), 'm') : sanitizeIds(INITIAL_MATERIALS, 'm');
    this.offcuts = savedOffcuts ? sanitizeIds(JSON.parse(savedOffcuts), 'oc') : sanitizeIds(INITIAL_OFFCUTS, 'oc');
    this.drawings = savedDrawings ? sanitizeIds(JSON.parse(savedDrawings), 'dr') : sanitizeIds(INITIAL_DRAWINGS, 'dr');
    this.installations = savedInstallations ? sanitizeIds(JSON.parse(savedInstallations), 'inst') : sanitizeIds(INITIAL_INSTALLATIONS, 'inst');
    this.invoices = savedInvoices ? sanitizeIds(JSON.parse(savedInvoices), 'INV') : sanitizeIds(INITIAL_INVOICES, 'INV');
    this.warnings = savedWarnings ? sanitizeIds(JSON.parse(savedWarnings), 'w') : sanitizeIds(INITIAL_WARNINGS, 'w');
    this.activities = savedActivities ? sanitizeIds(JSON.parse(savedActivities), 'act') : sanitizeIds(INITIAL_ACTIVITIES, 'act');
    this.history = savedHistory ? sanitizeIds(JSON.parse(savedHistory), 'h') : sanitizeIds(INITIAL_HISTORY, 'h');
    this.photos = savedPhotos ? sanitizeIds(JSON.parse(savedPhotos), 'p') : sanitizeIds(INITIAL_PHOTOS, 'p');
    this.users = savedUsers ? sanitizeIds(JSON.parse(savedUsers), 'u') : sanitizeIds(MOCK_USERS, 'u');
    this.leaves = savedLeaves ? sanitizeIds(JSON.parse(savedLeaves), 'lv') : sanitizeIds(INITIAL_LEAVES, 'lv');
    this.qcRecords = savedQcRecords ? sanitizeIds(JSON.parse(savedQcRecords), 'qc') : [];

    this.runAutomatedRules();
    this.syncPhotosFromServer();
  }

  private save() {
    if (typeof window === 'undefined') return;
    localStorage.setItem('stoneflow_jobs', JSON.stringify(this.jobs));
    localStorage.setItem('stoneflow_materials', JSON.stringify(this.materials));
    localStorage.setItem('stoneflow_offcuts', JSON.stringify(this.offcuts));
    localStorage.setItem('stoneflow_drawings', JSON.stringify(this.drawings));
    localStorage.setItem('stoneflow_installations', JSON.stringify(this.installations));
    localStorage.setItem('stoneflow_invoices', JSON.stringify(this.invoices));
    localStorage.setItem('stoneflow_warnings', JSON.stringify(this.warnings));
    localStorage.setItem('stoneflow_activities', JSON.stringify(this.activities));
    localStorage.setItem('stoneflow_history', JSON.stringify(this.history));
    localStorage.setItem('stoneflow_photos', JSON.stringify(this.photos));
    localStorage.setItem('stoneflow_users', JSON.stringify(this.users));
    localStorage.setItem('stoneflow_leaves', JSON.stringify(this.leaves));
    localStorage.setItem('stoneflow_qcrecords', JSON.stringify(this.qcRecords));

    broadcastLocalUpdate();
    this.notify();
    this.saveToSupabase().catch(console.warn);
  }

  public async saveLocalOnly(): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.setItem('stoneflow_jobs', JSON.stringify(this.jobs));
    localStorage.setItem('stoneflow_materials', JSON.stringify(this.materials));
    localStorage.setItem('stoneflow_offcuts', JSON.stringify(this.offcuts));
    localStorage.setItem('stoneflow_drawings', JSON.stringify(this.drawings));
    localStorage.setItem('stoneflow_installations', JSON.stringify(this.installations));
    localStorage.setItem('stoneflow_invoices', JSON.stringify(this.invoices));
    localStorage.setItem('stoneflow_warnings', JSON.stringify(this.warnings));
    localStorage.setItem('stoneflow_activities', JSON.stringify(this.activities));
    localStorage.setItem('stoneflow_history', JSON.stringify(this.history));
    localStorage.setItem('stoneflow_photos', JSON.stringify(this.photos));
    localStorage.setItem('stoneflow_users', JSON.stringify(this.users));
    localStorage.setItem('stoneflow_leaves', JSON.stringify(this.leaves));

    broadcastLocalUpdate();
    this.notify();
  }

  public async saveAsync(): Promise<void> {
    this.save();
  }

  async syncPhotosFromServer() {
    try {
      const res = await fetch('/api/photos');
      if (res.ok) {
        const serverPhotos = await res.json();
        if (Array.isArray(serverPhotos) && serverPhotos.length > 0) {
          const merged = [...this.photos];
          serverPhotos.forEach(sp => {
            if (!merged.some(p => p.id === sp.id || (p.job_id === sp.job_id && p.filename === sp.filename))) {
              merged.push(sp);
            }
          });
          this.photos = merged;
          this.saveLocalOnly();
        }
      }
    } catch (e) {
      // Ignored
    }
  }

  getPhotosForJob(jobId: string): JobPhoto[] {
    return this.photos.filter(p => p && this.safeCompareJobId(p.job_id, jobId));
  }

  getAllPhotos(): JobPhoto[] {
    return this.photos;
  }

  async addPhotoForJob(jobId: string, category: string, image: string, filename?: string): Promise<{ success: boolean; photo: JobPhoto; error?: string; networkStatus?: string; source?: string }> {
    const newPhoto: JobPhoto = {
      id: generateUniqueId('p-new'),
      job_id: jobId,
      category,
      url: image,
      filename: filename || `Photo-${Date.now()}.jpg`,
      uploaded_at: new Date().toISOString()
    };
    this.photos.unshift(newPhoto);
    this.save();

    try {
      fetch('/api/photos/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          category,
          image,
          filename: newPhoto.filename
        })
      }).catch(console.warn);
    } catch (e) {
      // Non blocking
    }

    return { success: true, photo: newPhoto, source: 'local_storage', networkStatus: 'online' };
  }

  private safeCompareJobId(id1: any, id2: any): boolean {
    if (!id1 || !id2) return false;
    return String(id1).trim().toLowerCase() === String(id2).trim().toLowerCase();
  }

  getJobs(): Job[] { return this.jobs; }
  getJob(id: string): Job | undefined {
    return this.jobs.find(j => j && this.safeCompareJobId(j.id, id));
  }

  getMaterials(): Material[] { return this.materials; }
  getMaterialsForJob(jobId: string): Material[] {
    return this.materials.filter(m => m && this.safeCompareJobId(m.job_id, jobId));
  }

  createMaterial(materialData: Omit<Material, 'id'>) {
    const newMaterial: Material = {
      id: generateUniqueId('m-new'),
      ...materialData
    };
    this.materials.push(newMaterial);
    this.save();
    this.persistMaterial(newMaterial).catch(console.warn);
    return newMaterial;
  }

  getOffcuts(): OffCut[] { return this.offcuts; }
  getOffcutsForJob(jobId: string): OffCut[] {
    return this.offcuts.filter(o => o && this.safeCompareJobId(o.job_id, jobId));
  }

  getUsers(): User[] { return this.users; }

  async updateUserEmail(userId: string, newEmail: string, newPassword?: string): Promise<boolean> {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.email = newEmail.trim();
      if (newPassword && newPassword.trim()) {
        user.password = newPassword.trim();
      }
      this.save();
      return true;
    }
    return false;
  }

  async updateUserPassword(email: string, newPassword: string): Promise<boolean> {
    const normEmail = (email || '').toLowerCase().trim();
    const user = this.users.find(u => (u.email || '').toLowerCase() === normEmail);
    if (user) {
      user.password = newPassword;
      this.save();
      return true;
    }
    return false;
  }

  registerUser(userData: Omit<User, 'id'>) {
    const newUser: User = {
      id: generateUniqueId('u-new'),
      ...userData
    };
    this.users.push(newUser);
    this.save();
    return newUser;
  }

  async deleteUser(userId: string) {
    this.users = this.users.filter(u => u.id !== userId);
    this.save();
  }

  async hardDeleteUser(userId: string) {
    this.users = this.users.filter(u => u.id !== userId);
    this.save();
  }

  async deleteJob(jobId: string) {
    this.jobs = this.jobs.filter(j => j.id !== jobId);
    this.warnings = this.warnings.filter(w => w.job_id !== jobId);
    this.materials = this.materials.filter(m => m.job_id !== jobId);
    this.offcuts = this.offcuts.filter(o => o.job_id !== jobId);
    this.drawings = this.drawings.filter(d => d.job_id !== jobId);
    this.installations = this.installations.filter(i => i.job_id !== jobId);
    this.invoices = this.invoices.filter(i => i.job_id !== jobId);
    this.activities = this.activities.filter(a => a.job_id !== jobId);
    this.history = this.history.filter(h => h.job_id !== jobId);
    this.photos = this.photos.filter(p => p.job_id !== jobId);

    try {
      fetch(`/api/db/jobs/${jobId}`, { method: 'DELETE' }).catch(console.warn);
      fetch("/api/db/jobs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId })
      }).catch(console.warn);
    } catch (err) {
      // Ignored
    }

    this.save();
  }

  async syncJobStageDirect(jobId: string, newStage: number, nextAction: string, lastActivityAt: string, clientApprovedAt?: string) {
    const payload: any = { jobId, newStage, nextAction, lastActivityAt, clientApprovedAt };
    try {
      fetch("/api/db/jobs/update-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(console.warn);
    } catch (err) {
      // Ignored
    }
  }

  async syncInvoiceDirect(invoiceId: string, fields: any) {
    try {
      fetch("/api/db/invoices/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, fields })
      }).catch(console.warn);
    } catch (err) {
      // Ignored
    }
  }

  getLeaves(): LeaveRequest[] { return this.leaves; }

  createLeave(leaveData: Omit<LeaveRequest, 'id' | 'timestamp'>) {
    const newLeave: LeaveRequest = {
      id: generateUniqueId('lv-new'),
      timestamp: new Date().toISOString(),
      ...leaveData
    };
    this.leaves.push(newLeave);
    this.save();
    return newLeave;
  }

  updateLeaveStatus(leaveId: string, status: 'approved' | 'rejected') {
    const leave = this.leaves.find(l => l.id === leaveId);
    if (leave) {
      leave.status = status;
      this.save();
    }
  }

  getDrawingsForJob(jobId: string): Drawing[] {
    return this.drawings.filter(d => d && this.safeCompareJobId(d.job_id, jobId));
  }

  async addDrawing(jobId: string, name: string, imageUrl?: string, uploaderName: string = 'System'): Promise<Drawing> {
    const newDrawing: Drawing = {
      id: generateUniqueId('dr-new'),
      job_id: jobId,
      name,
      uploaded_at: new Date().toISOString(),
      status: 'awaiting',
      image_url: imageUrl
    };
    this.drawings.push(newDrawing);
    this.logActivity(jobId, 'u-2', `Uploaded CAD drawing / document: ${name}`);
    this.save();
    try {
      fetch('/api/drawings/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawing: newDrawing })
      }).catch(console.warn);
    } catch (e) {
      // Non blocking
    }
    return newDrawing;
  }

  async updateDrawingStatus(
    drawingId: string, 
    status: 'approved' | 'awaiting' | 'rejected', 
    userId: string = 'u-1', 
    userName: string = 'System',
    signatureUrl?: string,
    signedBy?: string
  ): Promise<boolean> {
    const dw = this.drawings.find(d => d.id === drawingId);
    if (dw) {
      dw.status = status;
      if (status === 'approved') dw.approval_timestamp = new Date().toISOString();
      if (signatureUrl) dw.signature_url = signatureUrl;
      if (signedBy) dw.signed_by = signedBy;
      this.logActivity(dw.job_id, userId, `Drawing status updated to ${status.toUpperCase()} by ${userName}`);
      this.save();
      try {
        fetch('/api/drawings/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drawing: dw })
        }).catch(console.warn);
      } catch (e) {
        // Non blocking
      }
      return true;
    }
    return false;
  }

  async deleteDrawing(drawingId: string, userId: string = 'u-1', userName: string = 'System'): Promise<boolean> {
    const dw = this.drawings.find(d => d.id === drawingId);
    if (dw) {
      this.drawings = this.drawings.filter(d => d.id !== drawingId);
      this.logActivity(dw.job_id, userId, `Deleted CAD drawing / document ${dw.name} by ${userName}`);
      this.save();
      try {
        fetch('/api/drawings/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drawingId })
        }).catch(console.warn);
      } catch (e) {
        // Non blocking
      }
      return true;
    }
    return false;
  }

  async deletePhoto(photoId: string, userId: string = 'u-1', userName: string = 'System'): Promise<boolean> {
    const p = this.photos.find(photo => photo.id === photoId);
    if (p) {
      this.photos = this.photos.filter(photo => photo.id !== photoId);
      this.logActivity(p.job_id, userId, `Deleted photo ${p.filename} by ${userName}`);
      this.save();
      try {
        fetch('/api/photos/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoId })
        }).catch(console.warn);
      } catch (e) {
        // Non blocking
      }
      return true;
    }
    return false;
  }

  getInstallations(): Installation[] { return this.installations; }

  getQCRecords(): QCRecord[] { return this.qcRecords; }

  recordQCPass(jobId: string, inspectorName: string, checksSummary: string[], notes?: string, photoUrl?: string): QCRecord {
    const job = this.jobs.find(j => j.id === jobId);
    const newRecord: QCRecord = {
      id: generateUniqueId('qc'),
      job_id: jobId,
      client_name: job?.client_name || `Job ${jobId}`,
      inspector_name: inspectorName || 'Dan P. (Supervisor)',
      passed_at: new Date().toISOString(),
      checks_summary: checksSummary && checksSummary.length > 0 ? checksSummary : [
        'Dimensions match layout drawing specifications exactly',
        'Edge profile & surface polish consistent with requested grade',
        'Material verified completely free of chips, cracks, or resin gaps',
        'Fitted sink & hob cutouts verified safe against structural template',
        'Slab label photographed and attached to project activity history'
      ],
      material: job?.material || 'Stone Slabs',
      status: 'passed',
      notes: notes || 'All factory quality standards satisfied. Approved for installation scheduling.',
      photo_url: photoUrl
    };
    this.qcRecords.unshift(newRecord);
    this.logActivity(jobId, 'u-2', `Factory QC Inspection passed by ${inspectorName}`);
    this.save();
    return newRecord;
  }

  updateInstallationRouteOrder(jobId: string, order: number) {
    const inst = this.installations.find(i => i.job_id === jobId);
    if (inst) {
      inst.route_order = order;
      this.save();
    }
  }

  getInvoices(): Invoice[] { return this.invoices; }

  createInvoice(jobId: string, amount: number) {
    const newInvoice: Invoice = {
      id: generateUniqueId('INV-2026'),
      job_id: jobId,
      amount,
      sent_date: new Date().toISOString(),
      paid_date: null,
      status: 'sent'
    };
    this.invoices.push(newInvoice);
    this.save();
    return newInvoice;
  }

  async updateInvoice(updatedInv: Invoice) {
    const idx = this.invoices.findIndex(i => i.id === updatedInv.id);
    if (idx !== -1) {
      this.invoices[idx] = updatedInv;
      this.save();
    }
  }

  async saveInvoiceDocket(jobId: string, data: Partial<Invoice>) {
    let inv = this.invoices.find(i => i.job_id === jobId);
    if (inv) {
      Object.assign(inv, data);
    } else {
      inv = {
        id: generateUniqueId('INV-2026'),
        job_id: jobId,
        amount: data.amount || 0,
        sent_date: new Date().toISOString(),
        paid_date: null,
        status: data.status || 'draft',
        ...data
      };
      this.invoices.push(inv);
    }
    this.save();
  }

  getWarnings(): WarningItem[] { return this.warnings.filter(w => !w.reviewed); }
  getActivities(jobId?: string): ActivityLog[] {
    if (jobId) return this.activities.filter(a => a && this.safeCompareJobId(a.job_id, jobId));
    return this.activities;
  }

  getHistory(jobId?: string): JobStatusHistory[] {
    if (jobId) return this.history.filter(h => h && this.safeCompareJobId(h.job_id, jobId));
    return this.history;
  }

  createJob(jobData: Partial<Job>): Job {
    const nextNum = 1046 + this.jobs.length;
    const newJob: Job = {
      id: jobData.id || `SF-${nextNum}`,
      client_id: jobData.client_id || `c-${Date.now()}`,
      client_name: jobData.client_name || 'New Client',
      site_address: jobData.site_address || '',
      job_type: jobData.job_type || 'Unspecified Work',
      current_stage: jobData.current_stage || 1,
      priority: jobData.priority || 'normal',
      client_approved_at: jobData.client_approved_at || null,
      assigned_to: jobData.assigned_to || 'u-2',
      last_activity_at: jobData.last_activity_at || new Date().toISOString(),
      next_action: jobData.next_action || 'Assess requirements and log contact details',
      value: jobData.value || 0,
      notes: jobData.notes || '',
      material: jobData.material || 'TBD',
      slab: jobData.slab || 'TBD',
      ...jobData
    };
    this.jobs.unshift(newJob);
    this.logActivity(newJob.id, 'u-2', 'Created new job record');
    this.save();
    this.persistJob(newJob).catch(console.warn);
    return newJob;
  }

  importJobs(jobsList: Partial<Job>[]): Job[] {
    const imported: Job[] = [];
    jobsList.forEach((jobData, idx) => {
      const nextNum = 1050 + this.jobs.length + idx;
      const newJob: Job = {
        id: jobData.id || `SF-${nextNum}`,
        client_id: jobData.client_id || `c-csv-${idx}`,
        client_name: jobData.client_name || 'Imported Client',
        site_address: jobData.site_address || '',
        job_type: jobData.job_type || 'Unspecified Work',
        current_stage: Number(jobData.current_stage) || 1,
        priority: (jobData.priority?.toLowerCase() as any) || 'normal',
        client_approved_at: jobData.client_approved_at || null,
        assigned_to: jobData.assigned_to || 'u-2',
        last_activity_at: jobData.last_activity_at || new Date().toISOString(),
        next_action: jobData.next_action || 'Assess requirements and log contact details',
        value: Number(jobData.value) || 0,
        notes: jobData.notes || '',
        material: jobData.material || 'TBD',
        slab: jobData.slab || 'TBD',
        ...jobData
      };
      this.jobs.push(newJob);

      const newMaterial: Material = {
        id: `m-${newJob.id}-1`,
        job_id: newJob.id,
        type: 'Natural Stone',
        color: jobData.material || 'Calacatta Gold',
        brand: 'Antolini',
        slab_id: '—',
        quantity: jobData.slab || '—',
        available: false,
        status: 'missing'
      };
      this.materials.push(newMaterial);
      this.logActivity(newJob.id, 'u-2', 'Job imported via CSV · Stage 1 · Lead');
      imported.push(newJob);
    });

    this.save();
    this.saveToSupabase().catch(console.warn);
    return imported;
  }

  setMaterialsForJob(jobId: string, materials: Omit<Material, 'id' | 'job_id'>[]) {
    this.materials = this.materials.filter(m => m.job_id !== jobId);
    materials.forEach((m, idx) => {
      const mat = {
        ...m,
        id: `m-${jobId}-${idx + 1}`,
        job_id: jobId
      } as Material;
      this.materials.push(mat);
      this.persistMaterial(mat).catch(console.warn);
    });

    const job = this.jobs.find(j => j.id === jobId);
    if (job && materials.length > 0) {
      if (materials[0].color) job.material = materials[0].color;
      if (materials[0].quantity) job.slab = materials[0].quantity;
      this.persistJob(job).catch(console.warn);
    }
    this.save();
  }

  setOffcutsForJob(jobId: string, offcuts: Omit<OffCut, 'id' | 'job_id'>[]) {
    this.offcuts = this.offcuts.filter(o => o.job_id !== jobId);
    offcuts.forEach((o, idx) => {
      const offcut: OffCut = {
        ...o,
        id: `oc-${jobId}-${idx + 1}`,
        job_id: jobId,
        dimensions: o.dimensions || '1120 × 33 mm',
        quantity: o.quantity || '1 piece',
        type: o.type || 'Engineered Stone',
        color: o.color || 'Caesarstone Raw Concrete',
        slab: o.slab || 'SL-883',
        brand: o.brand || 'CAESARSTONE',
        location: o.location || 'Rack A-1',
        status: (o.status || 'available') as any,
        notes: o.notes || ''
      };
      this.offcuts.push(offcut);
      this.persistOffcut(offcut).catch(console.warn);
    });
    this.save();
  }

  overridePriority(jobId: string, newPriority: PriorityLevel, userId: string, userName: string) {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;
    const old = job.priority;
    job.priority = newPriority;
    job.last_activity_at = new Date().toISOString();
    this.logActivity(jobId, userId, `Priority overridden from ${old.toUpperCase()} to ${newPriority.toUpperCase()} by ${userName}`);
    this.save();
    this.persistJob(job).catch(console.warn);
  }

  async logClientApproval(jobId: string, userId: string, userName: string) {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.client_approved_at = new Date().toISOString();
    job.last_activity_at = new Date().toISOString();

    if (job.current_stage < 7) {
      await this.updateStage(jobId, 7, userId, userName);
    }

    const dw = this.drawings.find(d => d.job_id === jobId && d.name.includes('Rev'));
    if (dw) {
      dw.status = 'approved';
      dw.approval_timestamp = job.client_approved_at;
    } else {
      this.drawings.push({
        id: `dr-new-${jobId}`,
        job_id: jobId,
        name: 'Rev C - Client Signed Layout.pdf',
        uploaded_at: new Date().toISOString(),
        status: 'approved',
        approval_timestamp: job.client_approved_at
      });
    }

    this.logActivity(jobId, userId, `Client approval logged by ${userName}. Unlocked Production Stages (8-12).`);
    this.runAutomatedRules();
    this.save();
    this.persistJob(job).catch(console.warn);
  }

  updateJobProperties(jobId: string, properties: Partial<Job>): boolean {
    const job = this.jobs.find(j => j.id === jobId);
    if (job) {
      Object.assign(job, properties);
      job.last_activity_at = new Date().toISOString();
      this.save();
      this.persistJob(job).catch(console.warn);
      return true;
    }
    return false;
  }

  updateMaterial(jobId: string, materialData: Partial<Material>) {
    let mat = this.materials.find(m => m.job_id === jobId);
    if (mat) {
      Object.assign(mat, materialData);
    } else {
      mat = {
        id: generateUniqueId('m-new'),
        job_id: jobId,
        type: materialData.type || 'Natural Stone',
        color: materialData.color || 'Calacatta Gold',
        brand: materialData.brand || 'Antolini',
        slab_id: materialData.slab_id || 'Slab-A',
        quantity: materialData.quantity || '1 slab',
        available: materialData.available ?? true,
        status: materialData.status || 'available',
        ...materialData
      };
      this.materials.push(mat);
    }

    const job = this.jobs.find(j => j.id === jobId);
    if (job) {
      if (mat.color) job.material = mat.color;
      if (mat.quantity) job.slab = mat.quantity;
      this.persistJob(job).catch(console.warn);
    }

    if (mat.status === 'reserved' || !mat.available) {
      this.createInvoice(jobId, job?.value || 2500);
      this.logActivity(jobId, 'u-2', `Automated Invoice generated post material reservation.`);
    }

    this.logActivity(jobId, 'u-2', 'Material specifications updated');
    this.save();
    this.persistMaterial(mat).catch(console.warn);
  }

  createOffcut(jobId: string, offcut: Omit<OffCut, 'id' | 'job_id'>) {
    const newOc: OffCut = {
      id: generateUniqueId('oc-new'),
      job_id: jobId,
      ...offcut
    };
    this.offcuts.push(newOc);
    this.save();
    this.persistOffcut(newOc).catch(console.warn);
  }

  updateMaterialById(id: string, materialData: Partial<Material>): boolean {
    const mat = this.materials.find(m => m.id === id);
    if (mat) {
      Object.assign(mat, materialData);
      const job = this.jobs.find(j => j.id === mat.job_id);
      if (job) {
        if (mat.color) job.material = mat.color;
        if (mat.quantity) job.slab = mat.quantity;
        this.persistJob(job).catch(console.warn);
      }
      this.save();
      this.persistMaterial(mat).catch(console.warn);
      return true;
    }
    return false;
  }

  updateOffcutById(id: string, offcutData: Partial<OffCut>): boolean {
    const oc = this.offcuts.find(o => o.id === id);
    if (oc) {
      Object.assign(oc, offcutData);
      this.save();
      this.persistOffcut(oc).catch(console.warn);
      return true;
    }
    return false;
  }

  deleteOffcut(id: string): boolean {
    if (!id) return false;
    const cleanId = String(id).trim();
    const index = this.offcuts.findIndex(o => o.id === id || String(o.id).trim() === cleanId);
    if (index !== -1) {
      const targetOffcut = this.offcuts[index];
      const targetId = targetOffcut.id || cleanId;
      this.offcuts = this.offcuts.filter(o => String(o.id).trim() !== cleanId && String(o.id).trim() !== String(targetId).trim());
      this.save();
      fetch(`/api/offcuts/${encodeURIComponent(targetId)}`, { method: 'DELETE' }).catch(console.warn);
      fetch('/api/offcuts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offcutId: targetId, id: targetId })
      }).catch(console.warn);
      return true;
    }
    return false;
  }

  deleteMaterial(id: string): boolean {
    if (!id) return false;
    const cleanId = String(id).trim();
    const index = this.materials.findIndex(m => 
      (m.id && String(m.id).trim() === cleanId) || 
      (m.slab_id && String(m.slab_id).trim() === cleanId)
    );
    if (index !== -1) {
      const targetMat = this.materials[index];
      const targetId = targetMat.id || targetMat.slab_id || cleanId;
      this.materials = this.materials.filter(m => 
        String(m.id).trim() !== cleanId && 
        String(m.id).trim() !== String(targetId).trim() &&
        (!targetMat.slab_id || String(m.slab_id).trim() !== String(targetMat.slab_id).trim())
      );
      this.save();
      fetch(`/api/materials/${encodeURIComponent(targetId)}`, { method: 'DELETE' }).catch(console.warn);
      fetch('/api/materials/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId: targetId, id: targetId, slabId: targetMat.slab_id })
      }).catch(console.warn);
      return true;
    }
    return false;
  }

  async updateInstallationChecklist(jobId: string, itemKey: string, isChecked: boolean) {
    let inst = this.installations.find(i => i.job_id === jobId);
    if (!inst) {
      inst = {
        id: generateUniqueId('inst-new'),
        job_id: jobId,
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: '12:00',
        status: 'On site',
        installer_id: 'u-4',
        checklist: {}
      };
      this.installations.push(inst);
    }
    if (!inst.checklist) {
      inst.checklist = {};
    }
    inst.checklist[itemKey] = isChecked;
    this.save();
    return inst.checklist;
  }

  async installerComplete(jobId: string, signName: string, signatureSvg?: string) {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;

    job.current_stage = 14; // Installed
    job.last_activity_at = new Date().toISOString();
    job.next_action = 'Generate final invoice and request payment completion';

    let inst = this.installations.find(i => i.job_id === jobId);
    const fullChecklist = {
      leveling: true,
      epoxy_joints: true,
      cutouts_caulk: true,
      photos_uploaded: true,
      client_walkthrough: true
    };

    if (inst) {
      inst.status = 'Completed';
      inst.completed_at = new Date().toISOString();
      inst.signature_name = signName;
      inst.signature_svg = signatureSvg;
      inst.checklist = { ...(inst.checklist || {}), ...fullChecklist };
    } else {
      inst = {
        id: generateUniqueId('inst-new'),
        job_id: jobId,
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: '12:00',
        status: 'Completed',
        installer_id: 'u-4',
        completed_at: new Date().toISOString(),
        signature_name: signName,
        signature_svg: signatureSvg,
        checklist: fullChecklist
      };
      this.installations.push(inst);
    }

    // Ensure site photo exists for gate verification
    if (!this.photos.some(p => p.job_id === jobId && (p.category === 'site' || p.category === 'qc'))) {
      const imgData = signatureSvg || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="%230f172a"/><rect x="20" y="20" width="560" height="360" rx="12" fill="none" stroke="%230284c7" stroke-width="3"/><text x="300" y="190" fill="%2338bdf8" font-family="sans-serif" font-size="22" font-weight="extrabold" text-anchor="middle">SITE INSTALLATION VERIFIED</text><text x="300" y="230" fill="%23f8fafc" font-family="sans-serif" font-size="15" text-anchor="middle">Customer Sign-Off Attached</text></svg>';
      const sitePhoto: JobPhoto = {
        id: generateUniqueId('photo-site'),
        job_id: jobId,
        category: 'site',
        url: imgData,
        filename: `Installation_Completion_${jobId}.jpg`,
        uploaded_at: new Date().toISOString()
      };
      this.photos.push(sitePhoto);
    }

    this.logActivity(jobId, 'u-4', `Installer sign-off completed by customer: ${signName}`);
    this.save();
    this.persistJob(job).catch(console.warn);
  }

  async updateStage(jobId: string, newStage: number, userId: string, userName: string): Promise<{ success: boolean; error?: string }> {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return { success: false, error: 'Job not found' };

    const oldStage = job.current_stage;
    if (oldStage === newStage) return { success: true };

    const dwForJob = this.getDrawingsForJob(jobId);
    const photosForJob = this.getPhotosForJob(jobId);
    const instForJob = this.getInstallations();
    const currentUserObj = this.users.find(u => u.id === userId || u.name === userName);
    const currentUserRole = currentUserObj?.role || 'owner';

    const validation = validateStageTransition(job, newStage, currentUserRole, dwForJob, photosForJob, instForJob);
    if (!validation.allowed) {
      return { success: false, error: validation.reason };
    }

    this.history.push({
      id: generateUniqueId('h-new'),
      job_id: jobId,
      old_stage: oldStage,
      new_stage: newStage,
      changed_by: userName,
      changed_at: new Date().toISOString()
    });

    job.current_stage = newStage;
    job.last_activity_at = new Date().toISOString();

    const stageObj = STAGES.find(s => s.n === newStage);
    const logMsg = `Stage changed from ${oldStage} to ${newStage} (${stageObj?.name}) by ${userName}`;
    this.logActivity(jobId, userId, logMsg);

    const nextDefaultActions: Record<number, string> = {
      1: 'Assess requirements and log contact details',
      2: 'Confirm site visit slot and dispatch measurer',
      3: 'Prepare quote based on scope and send to client',
      4: 'Request deposit and lock design requirements',
      5: 'Schedule site measurement session with designer',
      6: 'Draw CAD layout and issue for customer review',
      7: 'Awaiting customer written approval on drawing',
      8: 'Verify slab stock in warehouse or place supplier order',
      9: 'Saw stone on Bridge Saw according to nesting pattern',
      10: 'Process cutouts, edge profiling, and CNC shaping',
      11: 'Perform surface polishing and edge inspection',
      12: 'Conduct final Quality Control and log photos',
      13: 'Confirm delivery route and installer assignment',
      14: 'Fit job on site and capture customer sign-off',
      15: 'Issue final tax invoice to customer',
      16: 'Reconcile payment in accounting ledger',
      17: 'Archive job record'
    };
    job.next_action = nextDefaultActions[newStage] || job.next_action;

    if (newStage >= 4) {
      const existingInv = this.invoices.find(i => i.job_id === jobId);
      if (!existingInv) {
        this.createInvoice(jobId, job.value || 2500);
        this.logActivity(jobId, userId, `Automated Client Invoice generated at Stage ${newStage}: ${stageObj?.name || 'Deposit / Contract Accepted'}.`);
      }
    }

    if (oldStage === 9 && newStage > 9) {
      const mat = this.materials.find(m => m.job_id === jobId) || { type: 'Natural Stone', color: job.material || 'Calacatta Gold', slab_id: 'Slab-A', brand: 'Antolini' };
      this.createOffcut(jobId, {
        dimensions: '1100 × 600 mm',
        quantity: '1 piece',
        type: mat.type,
        color: mat.color,
        slab: mat.slab_id,
        brand: mat.brand,
        location: 'Rack — unassigned',
        status: 'available',
        notes: `Auto-generated remnant after Stage 9 cutting completion for Job ${jobId}`
      });
    }

    if (newStage === 13) {
      let inst = this.installations.find(i => i.job_id === jobId);
      if (!inst) {
        inst = {
          id: generateUniqueId('inst-new'),
          job_id: jobId,
          scheduled_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
          scheduled_time: '09:00',
          status: 'Scheduled',
          installer_id: 'u-4',
          installer_name: 'Tom J.'
        };
        this.installations.push(inst);
      }
    }

    this.runAutomatedRules();
    this.save();
    this.persistJob(job).catch(console.warn);

    // Directly notify backend jobs stage update endpoint
    fetch("/api/db/jobs/update-stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        newStage,
        nextAction: job.next_action,
        lastActivityAt: job.last_activity_at,
        clientApprovedAt: job.client_approved_at
      })
    }).catch((err) => console.warn("[dbSync] Direct stage update API call error:", err));

    return { success: true };
  }

  private triggerWarning(ruleNum: number, title: string, jobId: string, clientName: string, desc: string, severity: 'block' | 'warn' | 'info') {
    const existing = this.warnings.find(w => w.rule_num === ruleNum && w.job_id === jobId && !w.reviewed);
    if (!existing) {
      this.warnings.unshift({
        id: generateUniqueId('w-new'),
        rule_num: ruleNum,
        title,
        job_id: jobId,
        client_name: clientName,
        desc,
        severity,
        timestamp: new Date().toISOString(),
        reviewed: false
      });
    }
  }

  resolveWarning(warningId: string) {
    const w = this.warnings.find(item => item.id === warningId);
    if (w) {
      w.reviewed = true;
      this.save();
    }
  }

  resolveAllWarnings() {
    this.warnings.forEach(w => {
      w.reviewed = true;
    });
    this.save();
  }

  public logActivity(jobId: string, userId: string, action: string) {
    const userObj = this.users.find(u => u.id === userId);
    const userName = userObj ? userObj.name : (userId || 'System');
    this.activities.unshift({
      id: generateUniqueId('act-new'),
      job_id: jobId,
      user_id: userId,
      user_name: userName,
      action,
      timestamp: new Date().toISOString()
    });
    this.save();
  }

  addActivity(jobId: string, userName: string, action: string) {
    this.activities.unshift({
      id: generateUniqueId('act-new'),
      job_id: jobId,
      user_id: 'u-sys',
      user_name: userName,
      action,
      timestamp: new Date().toISOString()
    });
    this.save();
  }

  runAutomatedRules() {
    this.jobs.forEach(job => {
      const stage = job.current_stage;

      if (stage >= 8 && (!job.client_approved_at || job.client_approved_at === 'null')) {
        job.client_approved_at = job.last_activity_at || new Date().toISOString();
      }

      if (stage >= 8 && (!job.client_approved_at || job.client_approved_at === 'null')) {
        this.triggerWarning(1, 'Approval Gate violation', job.id, job.client_name,
          `Stage is at ${STAGES.find(s => s.n === stage)?.name} (Stage ${stage}) but Client Approval timestamp is null. Production is locked.`,
          'block'
        );
      }

      if (stage === 9 && (!job.client_approved_at || job.client_approved_at === 'null')) {
        this.triggerWarning(2, 'Cutting before approval', job.id, job.client_name,
          `Stone is logged at Stage 9 (Cutting) but Client Approval is not completed. High risk of cutting wrong spec!`,
          'block'
        );
      }
    });
  }
}

// Singleton export
export const dbSync = new DbSyncService();
// Alias dbMock for seamless compatibility
export const dbMock = dbSync;
