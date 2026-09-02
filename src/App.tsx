import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header, ActionLogItem } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { AllJobs } from './components/AllJobs';
import { CreateJob } from './components/CreateJob';
import { SalesPipeline } from './components/SalesPipeline';
import { DesignApproval } from './components/DesignApproval';
import { InFactory } from './components/InFactory';
import { InstallPage } from './components/InstallPage';
import { BillingClosed } from './components/BillingClosed';
import { WarningsPage } from './components/WarningsPage';
import { JobDetail } from './components/JobDetail';
import { AuthPage } from './components/AuthPage';
import { TeamManagement } from './components/TeamManagement';
import { QRModal } from './components/QRModal';
import { PhotoUploadModal } from './components/PhotoUploadModal';
import { QuickEditMaterialModal } from './components/QuickEditMaterialModal';
import { dbSync as dbMock, MOCK_USERS } from './lib/dbSync';
import { User, Job, OffCut } from './types';
import { Bell, Sparkles, CheckCircle2, AlertTriangle, X, Lock, Database, Copy, Plus, QrCode, Package, Scissors, Layers, MapPin, Maximize2, CalendarX, LayoutDashboard, ListTodo, ClipboardCheck, Trash2 } from 'lucide-react';

const getStoneStyle = (color?: string) => {
  const c = (color || '').toLowerCase();
  if (c.includes('calacatta')) {
    return {
      background: 'linear-gradient(135deg, #fafaf8 0%, #f3f1ec 45%, #d5c399 47%, #bda474 48%, #f3f1ec 50%, #e8e6e0 100%)',
      veins: 'rgba(213, 195, 153, 0.45)',
      borderColor: '#e2dfd7'
    };
  }
  if (c.includes('nero') || c.includes('black') || c.includes('marquina')) {
    return {
      background: 'linear-gradient(125deg, #111215 0%, #1a1c23 48%, #ffffff 49%, #ffffff 51%, #1a1c23 52%, #090a0c 100%)',
      veins: 'rgba(255, 255, 255, 0.75)',
      borderColor: '#2e313a'
    };
  }
  if (c.includes('verde') || c.includes('green') || c.includes('alpi')) {
    return {
      background: 'linear-gradient(140deg, #0e271c 0%, #173f2e 40%, #b2dbcc 41%, #173f2e 43%, #081711 100%)',
      veins: 'rgba(178, 219, 204, 0.6)',
      borderColor: '#1f4c39'
    };
  }
  if (c.includes('silestone') || c.includes('ethereal') || c.includes('white')) {
    return {
      background: 'linear-gradient(130deg, #f6f8fb 0%, #ebedf3 65%, #9cb2c9 67%, #ebedf3 69%, #f6f8fb 100%)',
      veins: 'rgba(156, 178, 201, 0.45)',
      borderColor: '#d2d8e4'
    };
  }
  if (c.includes('emperador') || c.includes('brown') || c.includes('dark')) {
    return {
      background: 'linear-gradient(135deg, #3c261b 0%, #4e3527 38%, #e7d3bf 40%, #4e3527 42%, #291810 100%)',
      veins: 'rgba(231, 211, 191, 0.55)',
      borderColor: '#5c4132'
    };
  }
  if (c.includes('jasper') || c.includes('ocean')) {
    return {
      background: 'radial-gradient(circle at 40% 40%, #5d9d9b 0%, #275654 35%, #99cbc9 37%, #1a3c3b 65%, #0f2423 100%)',
      veins: 'rgba(153, 203, 201, 0.55)',
      borderColor: '#3a6c6a'
    };
  }
  return {
    background: 'linear-gradient(145deg, #e3e4e6 0%, #cbd0d4 50%, #9aa0a6 100%)',
    veins: 'rgba(255, 255, 255, 0.35)',
    borderColor: '#b2b7bd'
  };
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('stoneflow_authenticated') === 'true';
  });
  const [workspace, setWorkspace] = useState<'office' | 'factory'>('office');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const stored = localStorage.getItem('stoneflow_user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return MOCK_USERS[0]; // Mehwish (Owner)
  });
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Action Notification toggle & state
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('stoneflow_action_notifications') !== 'false';
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastIsWarn, setToastIsWarn] = useState(false);
  const [toastType, setToastType] = useState<'delete' | 'create' | 'ai' | 'update' | 'info'>('info');
  const [actionLogs, setActionLogs] = useState<ActionLogItem[]>(() => {
    try {
      const stored = localStorage.getItem('stoneflow_action_logs');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [
      {
        id: 'init-1',
        title: 'System Ready',
        message: 'Action notifications activated. Delete, job create, AI and update tasks will trigger notifications.',
        type: 'info',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  // Global QR Scanner & Label Generator modal states
  const [globalQRState, setGlobalQRState] = useState<{
    isOpen: boolean;
    mode: 'scan' | 'show';
    targetType?: 'slab' | 'offcut' | 'job';
    targetId?: string;
    payload?: { title: string; subtitle: string; extra?: string };
  }>({
    isOpen: false,
    mode: 'scan'
  });

  // Global Photo Upload states
  const [globalPhotoState, setGlobalPhotoState] = useState<{
    isOpen: boolean;
    jobId: string;
    category: 'qc' | 'site' | 'general';
  }>({
    isOpen: false,
    jobId: '',
    category: 'general'
  });

  // Sync DB / warnings count / invoice counts
  const [jobs, setJobs] = useState<Job[]>([]);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [offcuts, setOffcuts] = useState<OffCut[]>([]);
  const [activeMaterialTab, setActiveMaterialTab] = useState<'slabs' | 'offcuts' | 'cutouts'>('slabs');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaves, setLeaves] = useState<any[]>([]);

  // Quick Edit Material Modal state
  const [quickEditItem, setQuickEditItem] = useState<{
    id: string;
    type: 'slab' | 'offcut';
    color: string;
    quantity: string;
    status: string;
    location?: string;
    brand?: string;
    dimensions?: string;
    slab_id?: string;
  } | null>(null);

  // Modals Open Triggers
  const openQRScanner = () => {
    setGlobalQRState({
      isOpen: true,
      mode: 'scan'
    });
  };

  const openQRShow = (type: 'slab' | 'offcut' | 'job', id: string, payload: any) => {
    setGlobalQRState({
      isOpen: true,
      mode: 'show',
      targetType: type,
      targetId: id,
      payload
    });
  };

  const openPhotoUpload = (jobId: string, category: 'qc' | 'site' | 'general') => {
    setGlobalPhotoState({
      isOpen: true,
      jobId,
      category
    });
  };

  const loadData = () => {
    const jobsList = dbMock.getJobs();
    const warningsList = dbMock.getWarnings();
    const activitiesList = dbMock.getActivities();
    const materialsList = dbMock.getMaterials();
    const offcutsList = dbMock.getOffcuts();
    const leavesList = dbMock.getLeaves();

    setJobs([...jobsList]);
    setWarnings([...warningsList]);
    setActivities([...activitiesList]);
    setMaterials([...materialsList]);
    setOffcuts([...offcutsList]);
    setLeaves([...leavesList]);

    const usersList = dbMock.getUsers();
    setAllUsers([...usersList]);

    // Diagnostic console logging
    console.group('--- STONEFLOW APP STATE DIAGNOSTICS ---');
    console.log('[Data Loader] Loaded records from Express DB / dbMock:');
    console.log(` - Jobs count: ${jobsList.length}`);
    console.log(` - Warnings count: ${warningsList.length}`);
    console.log(` - Activities count: ${activitiesList.length}`);
    console.log(` - Materials count: ${materialsList.length}`);
    console.log(`[Express DB Connection State]: Running on Express / Node.js Server DB persistence.`);
    console.groupEnd();
  };

  useEffect(() => {
    loadData();
    // Subscribe to real-time changes (BroadcastChannel + Express DB events)
    const unsubscribe = dbMock.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Parse URL parameter to open shared job files directly (resolving "job link not open")
    const params = new URLSearchParams(window.location.search);
    const jobParam = params.get('job');
    if (jobParam) {
      const normalizedId = jobParam.startsWith('SF-') ? jobParam : `SF-${jobParam}`;
      setCurrentPage(`job-${normalizedId}`);
    } else {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#job-')) {
        const hashJobId = hash.replace('#job-', '');
        const normalizedId = hashJobId.startsWith('SF-') ? hashJobId : `SF-${hashJobId}`;
        setCurrentPage(`job-${normalizedId}`);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [currentPage]);

  // Session eviction hook: if user deleted, immediately log them out
  useEffect(() => {
    if (isAuthenticated && allUsers.length > 0) {
      const exists = allUsers.some(u => u.id === currentUser.id);
      if (!exists && currentUser.role !== 'owner') {
        handleLogout();
        triggerToast('Your account has been deleted by an administrator.', true);
      }
    }
  }, [allUsers, isAuthenticated, currentUser]);

  // Handle Theme switching class toggle
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleNotifications = (enabled?: boolean) => {
    const nextVal = enabled !== undefined ? enabled : !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    localStorage.setItem('stoneflow_action_notifications', nextVal ? 'true' : 'false');
  };

  const handleClearActionLogs = () => {
    setActionLogs([]);
    localStorage.removeItem('stoneflow_action_logs');
  };

  const inferActionType = (msg: string, isWarn: boolean, explicitType?: 'delete' | 'create' | 'ai' | 'update' | 'info'): 'delete' | 'create' | 'ai' | 'update' | 'info' => {
    if (explicitType) return explicitType;
    const lower = msg.toLowerCase();
    if (lower.includes('delete') || lower.includes('removed') || lower.includes('revoked') || lower.includes('hard-delete') || lower.includes('clear')) {
      return 'delete';
    }
    if (lower.includes('ai') || lower.includes('pdf') || lower.includes('gemini') || lower.includes('parse') || lower.includes('cad qa') || lower.includes('write job')) {
      return 'ai';
    }
    if (lower.includes('create') || lower.includes('created') || lower.includes('added') || lower.includes('registered') || lower.includes('generated') || lower.includes('uploaded')) {
      return 'create';
    }
    if (lower.includes('update') || lower.includes('save') || lower.includes('stage') || lower.includes('switched') || lower.includes('login') || lower.includes('sync') || lower.includes('password')) {
      return 'update';
    }
    return isWarn ? 'update' : 'info';
  };

  // Standard action toast trigger with toggle & log classification support
  const triggerToast = (msg: string, isWarn = false, explicitType?: 'delete' | 'create' | 'ai' | 'update' | 'info') => {
    const resolvedType = inferActionType(msg, isWarn, explicitType);
    
    // Always append to Action Log History (viewable in Bell popover)
    const newLog: ActionLogItem = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: resolvedType === 'delete' ? 'Delete Action'
           : resolvedType === 'create' ? 'Record Created'
           : resolvedType === 'ai' ? 'AI PDF Task'
           : resolvedType === 'update' ? 'Update & Sync'
           : 'Action Notification',
      message: msg,
      type: resolvedType,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isWarn
    };

    setActionLogs(prev => {
      const updated = [newLog, ...prev.slice(0, 49)];
      try {
        localStorage.setItem('stoneflow_action_logs', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    loadData(); // Re-sync active states on any state trigger

    // If notifications are toggled OFF, suppress the popup banner
    if (!notificationsEnabled) {
      return;
    }

    setToastMsg(msg);
    setToastIsWarn(isWarn);
    setToastType(resolvedType);

    setTimeout(() => {
      setToastMsg(null);
    }, 4500);
  };

  const handleQuickEditSave = (
    id: string,
    type: 'slab' | 'offcut',
    updatedFields: {
      color: string;
      quantity: string;
      status: string;
      location?: string;
      dimensions?: string;
      rack?: string;
      coordinates?: string;
    }
  ) => {
    if (type === 'slab') {
      const mat = materials.find(m => m.id === id || m.slab_id === id);
      if (mat) {
        dbMock.updateMaterialById(mat.id, {
          color: updatedFields.color,
          quantity: updatedFields.quantity,
          status: updatedFields.status as any,
          available: updatedFields.status === 'available',
          dimensions: updatedFields.dimensions,
          rack: updatedFields.rack,
          coordinates: updatedFields.coordinates,
        });
        triggerToast('Slab material details quick-updated successfully.');
      } else {
        triggerToast('Could not find slab record to update.', true);
      }
    } else {
      dbMock.updateOffcutById(id, {
        color: updatedFields.color,
        quantity: updatedFields.quantity,
        status: updatedFields.status as any,
        dimensions: updatedFields.dimensions || '',
        location: updatedFields.location || '',
      });
      triggerToast('Remnant/Offcut details quick-updated successfully.');
    }
    loadData();
  };

  const handleQuickEditDelete = (id: string, type: 'slab' | 'offcut') => {
    if (type === 'slab') {
      const mat = materials.find(m => m.id === id || m.slab_id === id);
      const targetId = mat ? (mat.id || mat.slab_id || id) : id;
      dbMock.deleteMaterial(targetId);
      triggerToast('Slab material deleted from database.', false);
    } else {
      dbMock.deleteOffcut(id);
      triggerToast('Remnant/Offcut deleted from database.', false);
    }
    loadData();
  };

  // Sync workspace and roles
  const handleUserChange = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('stoneflow_user', JSON.stringify(user));
    if (user.role === 'factory') {
      setWorkspace('factory');
      setCurrentPage('cutting-queue');
    } else if (user.role === 'installer') {
      setWorkspace('factory');
      setCurrentPage('installations');
    } else {
      setWorkspace('office');
      setCurrentPage('dashboard');
    }
    triggerToast(`Switched active profile to ${user.name} (${user.role.toUpperCase()})`);
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('stoneflow_authenticated', 'true');
    localStorage.setItem('stoneflow_user', JSON.stringify(user));
    
    if (user.role === 'factory') {
      setWorkspace('factory');
      setCurrentPage('cutting-queue');
    } else if (user.role === 'installer') {
      setWorkspace('factory');
      setCurrentPage('installations');
    } else {
      setWorkspace('office');
      setCurrentPage('dashboard');
    }
    
    triggerToast(`Logged in successfully as ${user.name} (${user.role.toUpperCase()})`);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('stoneflow_authenticated');
    localStorage.removeItem('stoneflow_user');
    triggerToast('Logged out of workspace');
  };

  const handleWorkspaceChange = (ws: 'office' | 'factory') => {
    setWorkspace(ws);
    if (ws === 'factory') {
      setCurrentPage('cutting-queue');
    } else {
      setCurrentPage('dashboard');
    }
  };

  // Handle page change
  const handlePageChange = (page: string) => {
    if (page === 'absence' || page === 'leave') {
      console.log(`[Router Bypass] Page '${page}' requested but completely bypassed by security routing guidelines.`);
      return;
    }
    let normalizedPage = page;
    if (page.startsWith('job-')) {
      const rawId = page.replace('job-', '');
      const normalizedId = rawId.startsWith('SF-') ? rawId : `SF-${rawId}`;
      normalizedPage = `job-${normalizedId}`;
    }
    setCurrentPage(normalizedPage);
    setMobileMenuOpen(false);
  };

  const activeInvoicesCount = dbMock.getInvoices().length;

  // Routing Component Selector
  const renderCurrentPage = () => {
    // Role-based routing guards to enforce 'only their access' and 'no owner access'
    const role = currentUser.role;
    const isOwner = role === 'owner';
    const isOffice = role === 'office';
    const isFactory = role === 'factory';
    const isInstaller = role === 'installer';

    const isPageAuthorized = (page: string): boolean => {
      if (isOwner) return true;
      if (page.startsWith('job-')) return true; // JobDetail component itself handles inner permission states
      
      if (isOffice) {
        return ['dashboard', 'all-jobs', 'sales-pipeline', 'design-approval', 'create-job', 'materials', 'installations'].includes(page);
      }
      if (isFactory) {
        return ['cutting-queue', 'qc-station', 'materials'].includes(page);
      }
      if (isInstaller) {
        return ['installations'].includes(page);
      }
      return false;
    };

    if (!isPageAuthorized(currentPage)) {
      return (
        <div className="p-8 text-center bg-paper border border-line rounded-2xl max-w-md mx-auto space-y-4 shadow-sm my-12 animate-fade-in">
          <div className="w-12 h-12 bg-rubysoft text-ruby rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-disp font-extrabold text-ink">Access Restricted</h2>
          <p className="text-xs text-mut leading-relaxed">
            Your user role ({role.toUpperCase()}) does not have permission to view this section of the workspace.
          </p>
          <button
            onClick={() => {
              if (isFactory) handlePageChange('cutting-queue');
              else if (isInstaller) handlePageChange('installations');
              else handlePageChange('dashboard');
            }}
            className="px-4 py-2 bg-ink text-white rounded-xl text-xs font-semibold hover:opacity-90 dark:bg-zinc-200 dark:text-black cursor-pointer"
          >
            Go to My Dashboard
          </button>
        </div>
      );
    }

    if (currentPage.startsWith('job-')) {
      const rawJobId = currentPage.replace('job-', '');
      const jobId = rawJobId.startsWith('SF-') ? rawJobId : `SF-${rawJobId}`;
      return (
        <JobDetail
          jobId={jobId}
          onBack={() => handlePageChange(workspace === 'office' ? 'dashboard' : 'cutting-queue')}
          onToast={triggerToast}
          currentUser={currentUser}
          onAddPhotoClick={openPhotoUpload}
          onShowQRClick={openQRShow}
        />
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            jobs={jobs}
            materials={materials}
            warnings={warnings}
            activities={activities}
            onPageChange={handlePageChange}
            onJobSelect={(id) => handlePageChange(`job-${id}`)}
            currentUser={currentUser}
          />
        );
      case 'all-jobs':
        return (
          <AllJobs
            jobs={jobs}
            onJobSelect={(id) => handlePageChange(`job-${id}`)}
            onPageChange={handlePageChange}
            currentUser={currentUser}
            onDeleteJob={async (id) => {
              await dbMock.deleteJob(id);
              triggerToast('Job deleted successfully', false);
            }}
          />
        );
      case 'create-job':
        return (
          <CreateJob
            onPageChange={handlePageChange}
            onJobSelect={(id) => handlePageChange(`job-${id}`)}
            onToast={triggerToast}
          />
        );
      case 'sales-pipeline':
        return (
          <SalesPipeline
            jobs={jobs}
            onJobSelect={(id) => handlePageChange(`job-${id}`)}
            onPageChange={handlePageChange}
            currentUser={currentUser}
          />
        );
      case 'design-approval':
        return (
          <DesignApproval
            jobs={jobs}
            onJobSelect={(id) => handlePageChange(`job-${id}`)}
            onToast={triggerToast}
            currentUser={currentUser}
          />
        );
      case 'materials':
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-disp font-extrabold text-ink tracking-tight">Materials Inventory</h1>
                <p className="text-xs text-mut mt-1">Directly integrated material records and slab warehouse remnants.</p>
              </div>
              
              {/* Tab Switcher */}
              <div className="flex bg-soft rounded-xl p-1 border border-line select-none self-start sm:self-auto">
                <button
                  onClick={() => setActiveMaterialTab('slabs')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeMaterialTab === 'slabs' ? 'bg-paper text-sap shadow-sm' : 'text-mut hover:text-ink'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Active Slabs ({materials.length})
                </button>
                <button
                  onClick={() => setActiveMaterialTab('offcuts')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeMaterialTab === 'offcuts' ? 'bg-paper text-sap shadow-sm' : 'text-mut hover:text-ink'
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  Remnants &amp; Off-cuts ({offcuts.length})
                </button>
                <button
                  onClick={() => setActiveMaterialTab('cutouts')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeMaterialTab === 'cutouts' ? 'bg-paper text-sap shadow-sm' : 'text-mut hover:text-ink'
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5 text-am" />
                  Cutouts ({
                    jobs.reduce((acc, j) => {
                      let cList: any[] = [];
                      if (j.cutouts && Array.isArray(j.cutouts)) cList = j.cutouts;
                      else if ((j as any).cutouts_json) {
                        try { cList = JSON.parse((j as any).cutouts_json); } catch {}
                      }
                      return acc + (cList.length || 0);
                    }, 0)
                  })
                </button>
              </div>
            </div>

            {activeMaterialTab === 'slabs' && (
              <div className="space-y-6">
                {/* Form to create a new material & supplier */}
                <div className="bg-paper border border-line rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-soft pb-3">
                    <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                      <Plus className="w-4 h-4 text-sap" />
                      Register New Material / Slab &amp; Supplier Details
                    </h2>
                  </div>
                  
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const formData = new FormData(form);
                    
                    const color = formData.get('color') as string;
                    const type = formData.get('type') as string;
                    const dimensions = formData.get('dimensions') as string;
                    const quantity = formData.get('quantity') as string;
                    const brand = formData.get('brand') as string;
                    const slab_id = formData.get('slab_id') as string;
                    const supplier = formData.get('supplier') as string;
                    const supplier_address = formData.get('supplier_address') as string;
                    const notes = formData.get('notes') as string;
                    const rack = formData.get('rack') as string;
                    const coordinates = (formData.get('coordinates') as string || '').toUpperCase();

                    if (!color || !dimensions) {
                      triggerToast('Please provide Material Name (Color) and Dimensions', true);
                      return;
                    }

                    dbMock.createMaterial({
                      job_id: 'SF-1031',
                      type: type || 'Engineered Stone',
                      color,
                      brand: brand || 'Generic',
                      slab_id: slab_id || `SLAB-${Date.now().toString().slice(-4)}`,
                      quantity: quantity || '1 slab',
                      dimensions,
                      supplier: supplier || 'Warehouse Direct',
                      supplier_address: supplier_address || '',
                      available: true,
                      status: 'available',
                      notes: notes || '',
                      rack: rack || undefined,
                      coordinates: coordinates || undefined
                    });

                    triggerToast('Material slab & Supplier registered successfully.');
                    loadData();
                    form.reset();
                  }} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Material Name (Color) *</label>
                      <input name="color" type="text" placeholder="e.g. Arabescato Vagli" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Material Type</label>
                      <input name="type" type="text" placeholder="e.g. Natural Stone" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Dimensions *</label>
                      <input name="dimensions" type="text" placeholder="e.g. 3200 × 1600 mm" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Quantity / Slabs</label>
                      <input name="quantity" type="text" placeholder="e.g. 2 Slabs" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Brand / Manufacturer</label>
                      <input name="brand" type="text" placeholder="e.g. Caesarstone" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Slab ID / Batch</label>
                      <input name="slab_id" type="text" placeholder="e.g. SLAB-4412" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="font-bold text-ink uppercase text-[10px]">Supplier Name</label>
                      <input name="supplier" type="text" placeholder="e.g. Art Of Marble" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="space-y-1 md:col-span-4">
                      <label className="font-bold text-ink uppercase text-[10px]">Supplier Address (Multi-line Address Input)</label>
                      <textarea name="supplier_address" rows={2} placeholder="e.g. 11 Yulong Close,&#10;Moorebank. NSW 2170" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none resize-none" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="font-bold text-ink uppercase text-[10px]">Rack Label</label>
                      <input name="rack" type="text" placeholder="e.g. Rack A" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="font-bold text-ink uppercase text-[10px]">Grid Position (A1–E5)</label>
                      <input name="coordinates" type="text" placeholder="e.g. A3" maxLength={2} className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none font-mono uppercase" />
                    </div>
                    <div className="space-y-1 md:col-span-4">
                      <label className="font-bold text-ink uppercase text-[10px]">Additional Notes</label>
                      <input name="notes" type="text" placeholder="e.g. Reserved for future vanity tops" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="md:col-span-4 flex justify-end">
                      <button type="submit" className="px-4 py-2 bg-sap text-white rounded-xl font-bold cursor-pointer hover:opacity-95 transition-all">
                        Register Slab &amp; Supplier
                      </button>
                    </div>
                  </form>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {materials.map((m, idx) => {
                  const stoneStyle = getStoneStyle(m.color);
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setQuickEditItem({
                        id: m.id || m.slab_id,
                        type: 'slab',
                        color: m.color,
                        quantity: m.quantity,
                        status: m.status || (m.available ? 'available' : 'reserved'),
                        brand: m.brand,
                        dimensions: m.dimensions,
                        slab_id: m.slab_id
                      })}
                      className="bg-paper border border-line rounded-2xl p-5 shadow-sm space-y-4 hover:border-sap/40 cursor-pointer transition-all relative group"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-mut">SLAB ID: {m.slab_id}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-sap opacity-0 group-hover:opacity-100 transition-opacity">QUICK EDIT</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            m.available ? 'bg-emsoft text-em border-em/10' : 'bg-amsoft text-am border-am/10'
                          }`}>
                            {m.available ? 'AVAILABLE' : 'RESERVED'}
                          </span>
                        </div>
                      </div>

                      {/* Slab Texture Preview Panel */}
                      <div 
                        className="w-full h-32 rounded-xl border relative overflow-hidden flex items-end p-3 shadow-inner transition-transform duration-300 group-hover:scale-[1.02]"
                        style={{ 
                          background: stoneStyle.background, 
                          borderColor: stoneStyle.borderColor 
                        }}
                      >
                        {/* Depth shading effect */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                        
                        {/* Organic vein overlays */}
                        <div 
                          className="absolute inset-0 opacity-40 pointer-events-none"
                          style={{
                            backgroundImage: `radial-gradient(circle at 15% 25%, transparent 58%, ${stoneStyle.veins} 60%, transparent 63%), 
                                              radial-gradient(circle at 85% 75%, transparent 38%, ${stoneStyle.veins} 40%, transparent 42%)`
                          }}
                        />
                        
                        {/* Subtle lighting reflex */}
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/20 pointer-events-none" />
                        
                        {/* Material name and type watermark */}
                        <span className="relative z-10 text-[10px] font-bold text-white bg-black/40 backdrop-blur-md px-2 py-1 rounded">
                          {m.type || 'Slab Texture'}
                        </span>
                      </div>

                      <h3 className="font-disp font-bold text-lg text-ink leading-none">{m.color}</h3>
                      <div className="text-xs text-mut">Brand: {m.brand} • Quantity: {m.quantity || '1 Slab'}</div>
                      <div className="pt-3 border-t border-soft flex justify-between items-center text-xs">
                        <span className="text-ink font-semibold">Job Name: {jobs.find(j => j.id === m.job_id)?.client_name || m.job_id || 'SF-Stock'}</span>
                        <div className="flex items-center gap-2 relative z-10">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetId = m.id || m.slab_id;
                              if (targetId) {
                                dbMock.deleteMaterial(targetId);
                                triggerToast(`Slab material "${m.color}" deleted from database & backend.`, false);
                                loadData();
                              }
                            }}
                            className="p-1.5 text-mut hover:text-ruby hover:bg-rubysoft rounded-lg transition-all cursor-pointer flex items-center gap-1 group/btn"
                            title="Delete Slab Material"
                          >
                            <Trash2 className="w-4 h-4 text-ruby" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePageChange(`job-${m.job_id}`);
                            }}
                            className="font-bold text-sap hover:opacity-85"
                          >
                            Open Linked Job
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {activeMaterialTab === 'offcuts' && (
              <div className="space-y-6">
                {/* Form to create a new remnant/offcut */}
                <div className="bg-paper border border-line rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-soft pb-3">
                    <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                      <Plus className="w-4 h-4 text-sap" />
                      Register New Remaining Material / Off-cut
                    </h2>
                  </div>
                  
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const formData = new FormData(form);
                    
                    const color = formData.get('color') as string;
                    const type = formData.get('type') as string;
                    const dimensions = formData.get('dimensions') as string;
                    const sizeVal = formData.get('size') as string;
                    const location = formData.get('location') as string;
                    const brand = formData.get('brand') as string;
                    const slab = formData.get('slab') as string;
                    const notes = formData.get('notes') as string;

                    if (!color || !dimensions) {
                      triggerToast('Please provide Material Name (Color) and Dimensions', true);
                      return;
                    }

                    dbMock.createOffcut('SF-1031', {
                      dimensions,
                      quantity: sizeVal || '1 piece',
                      type: type || 'Engineered Stone',
                      color,
                      slab: slab || 'Unknown Slab',
                      brand: brand || 'Generic',
                      location: location || 'Warehouse Floor',
                      status: 'available',
                      notes
                    });

                    triggerToast('Remaining material (off-cut) registered successfully.');
                    loadData();
                    form.reset();
                  }} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Material Name (Color) *</label>
                      <input name="color" type="text" placeholder="e.g. Verde Alpi" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Material Type</label>
                      <input name="type" type="text" placeholder="e.g. Natural Stone" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Dimensions *</label>
                      <input name="dimensions" type="text" placeholder="e.g. 1200 × 640 mm" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Size / Qty (e.g. pieces)</label>
                      <input name="size" type="text" placeholder="e.g. 1 piece" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Brand / Supplier</label>
                      <input name="brand" type="text" placeholder="e.g. Caesarstone" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Slab Origin ID</label>
                      <input name="slab" type="text" placeholder="e.g. SF-9912" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Storage Location</label>
                      <input name="location" type="text" placeholder="e.g. Rack B-04" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-ink uppercase text-[10px]">Notes</label>
                      <input name="notes" type="text" placeholder="e.g. Premium back-matching edge" className="w-full px-3 py-2 bg-soft border border-line rounded-xl focus:outline-none" />
                    </div>
                    <div className="md:col-span-4 flex justify-end">
                      <button type="submit" className="px-4 py-2 bg-sap text-white rounded-xl font-bold cursor-pointer hover:opacity-95 transition-all">
                        Register Off-cut
                      </button>
                    </div>
                  </form>
                </div>

                {/* Grid of remaining materials (offcuts) with requested labels */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {offcuts.map((oc) => (
                    <div 
                      key={oc.id} 
                      onClick={() => setQuickEditItem({
                        id: oc.id,
                        type: 'offcut',
                        color: oc.color,
                        quantity: oc.quantity,
                        status: oc.status,
                        brand: oc.brand,
                        dimensions: oc.dimensions,
                        location: oc.location,
                        slab_id: oc.slab
                      })}
                      className="bg-paper border border-line rounded-2xl p-5 shadow-sm space-y-4 hover:border-sap/40 cursor-pointer transition-all relative group"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-mut uppercase tracking-wider flex items-center gap-1">
                          <Scissors className="w-3 h-3 text-sap" />
                          Remnant ID: {oc.id}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-sap opacity-0 group-hover:opacity-100 transition-opacity">QUICK EDIT</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emsoft text-em border border-em/10 uppercase">
                            {oc.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 border-l-2 border-sap/20 pl-3.5">
                        {/* Material Name */}
                        <div>
                          <span className="text-[9px] uppercase font-bold text-mut block">Material Name</span>
                          <span className="text-sm font-bold text-ink">{oc.color} <span className="text-xs font-normal text-mut">({oc.type})</span></span>
                        </div>
                        {/* Job Name */}
                        <div>
                          <span className="text-[9px] uppercase font-bold text-mut block">Job Name</span>
                          <span className="text-xs font-bold text-sap">
                            {jobs.find(j => j.id === oc.job_id)?.client_name ? `${jobs.find(j => j.id === oc.job_id)?.client_name} (${oc.job_id})` : `Job #${oc.job_id}`}
                          </span>
                        </div>
                        {/* Quantity */}
                        <div>
                          <span className="text-[9px] uppercase font-bold text-mut block">Quantity</span>
                          <span className="text-xs font-semibold text-ink">{oc.quantity || '1 piece'} <span className="text-[10px] text-mut">({oc.dimensions})</span></span>
                        </div>
                        {/* Location */}
                        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-mut">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Location: <strong className="text-ink">{oc.location}</strong></span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-soft flex justify-between items-center text-xs">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openQRShow('offcut', oc.id, {
                              title: `Remnant ${oc.id}`,
                              subtitle: `${oc.color} - ${oc.dimensions}`,
                              extra: `Location: ${oc.location}`
                            });
                          }}
                          className="text-[11px] font-bold text-sap flex items-center gap-1 hover:opacity-85 relative z-10"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          Get QR Sticker
                        </button>
                        <div className="flex items-center gap-2 relative z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (oc.id) {
                                dbMock.deleteOffcut(oc.id);
                                triggerToast(`Remnant offcut ${oc.id} deleted from database & backend.`, false);
                                loadData();
                              }
                            }}
                            className="p-1.5 text-mut hover:text-ruby hover:bg-rubysoft rounded-lg transition-all cursor-pointer flex items-center gap-1"
                            title="Delete Offcut"
                          >
                            <Trash2 className="w-4 h-4 text-ruby" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePageChange(`job-${oc.job_id}`);
                            }}
                            className="font-bold text-mut hover:text-ink"
                          >
                            View Linked Job
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeMaterialTab === 'cutouts' && (
              <div className="space-y-6">
                <div className="bg-paper border border-line rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-soft pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-am" />
                        Job Cutouts & Appliance Openings Register
                      </h2>
                      <p className="text-xs text-mut mt-0.5">
                        Extracted cutout specifications (Sinks, Cooktops, Tapholes, GPOs) from job sheets and drawings.
                      </p>
                    </div>
                  </div>

                {jobs.flatMap(j => {
                  let cList: any[] = [];
                  if (j.cutouts && Array.isArray(j.cutouts)) cList = j.cutouts;
                  else if ((j as any).cutouts_json) {
                    try { cList = JSON.parse((j as any).cutouts_json); } catch (e) { cList = []; }
                  }
                  return cList.map((c, idx) => ({ job: j, cutout: c, index: idx }));
                }).length === 0 ? (
                  <div className="p-8 text-center text-xs text-mut bg-soft/40 rounded-xl border border-dashed border-line">
                    No cutout specifications registered yet. Cutouts are automatically parsed when importing PDF job sheets or creating jobs.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {jobs.flatMap(j => {
                      let cList: any[] = [];
                      if (j.cutouts && Array.isArray(j.cutouts)) cList = j.cutouts;
                      else if ((j as any).cutouts_json) {
                        try { cList = JSON.parse((j as any).cutouts_json); } catch (e) { cList = []; }
                      }
                      return cList.map((c, idx) => ({ job: j, cutout: c, index: idx }));
                    }).map(({ job, cutout, index }) => (
                      <div
                        key={`${job.id}-cutout-${index}`}
                        className="bg-paper border border-line hover:border-sap/40 rounded-xl p-4 shadow-xs space-y-3 transition-all"
                      >
                        <div className="flex items-center justify-between border-b border-soft pb-2">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amsoft text-am border border-am/20">
                            {cutout.type || 'Cutout Opening'}
                          </span>
                          <span className="text-xs font-mono font-bold text-sap">
                            Job #{job.id}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="font-bold text-ink">
                            {cutout.brand || 'Standard'} {cutout.model || ''}
                          </div>
                          <div className="text-mut flex items-center justify-between">
                            <span>Cutout Size:</span>
                            <strong className="text-ink font-mono">{cutout.cutoutSize || cutout.dimensions || '780 × 480 mm'}</strong>
                          </div>
                          <div className="text-mut flex items-center justify-between">
                            <span>Mount Type:</span>
                            <span className="text-ink font-semibold">{cutout.mountType || 'Undermount'}</span>
                          </div>
                          {cutout.setback && (
                            <div className="text-mut flex items-center justify-between">
                              <span>Setback (SB):</span>
                              <span className="text-ink font-mono">{cutout.setback}</span>
                            </div>
                          )}
                          <div className="text-mut flex items-center justify-between pt-1 border-t border-soft">
                            <span>Customer / Site:</span>
                            <span className="text-ink font-semibold truncate max-w-[150px]">{job.client_name}</span>
                          </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => handlePageChange(`job-${job.id}`)}
                            className="text-xs font-bold text-sap hover:underline cursor-pointer"
                          >
                            View Job Details →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </div>
            )}
          </div>
        );
      case 'installations':
        return (
          <InstallPage
            jobs={jobs}
            onJobSelect={(id) => handlePageChange(`job-${id}`)}
            onToast={triggerToast}
            currentUser={currentUser}
            onAddPhotoClick={openPhotoUpload}
          />
        );
      case 'billing-closed':
        return (
          <BillingClosed
            jobs={jobs}
            onJobSelect={(id) => handlePageChange(`job-${id}`)}
            onToast={triggerToast}
            currentUser={currentUser}
          />
        );
      case 'team':
        return (
          <TeamManagement
            currentUser={currentUser}
            onToast={triggerToast}
          />
        );
      case 'warnings':
        return (
          <WarningsPage
            warnings={warnings}
            onJobSelect={(id) => handlePageChange(`job-${id}`)}
            onToast={triggerToast}
            currentUser={currentUser}
          />
        );
      case 'cutting-queue':
      case 'qc-station':
        return (
          <InFactory
            jobs={jobs}
            onJobSelect={(id) => handlePageChange(`job-${id}`)}
            onToast={triggerToast}
            currentUser={currentUser}
            onAddPhotoClick={openPhotoUpload}
          />
        );
      default:
        return <div className="p-8 text-center text-mut font-semibold">Page not found</div>;
    }
  };

  const getScrollbarColors = (role: string) => {
    switch (role) {
      case 'owner':
        return { color: '#8F6410', hover: '#7A520A' }; // Saffron Gold Brown
      case 'office':
        return { color: '#78350F', hover: '#5E290B' }; // Warm Chocolate Brown
      case 'factory':
        return { color: '#9A3412', hover: '#7C2D12' }; // Rust Red Brown
      case 'installer':
        return { color: '#D97706', hover: '#B45309' }; // Amber Ochre Brown
      default:
        return { color: '#8F6410', hover: '#7A520A' };
    }
  };

  const scrollbarColors = getScrollbarColors(currentUser?.role || 'owner');

  const isSmallDevice = typeof window !== 'undefined' && window.innerWidth < 1024;
  const displayWarningsCount = warnings.filter(warn => {
    if (currentUser?.role === 'owner' && isSmallDevice) {
      const titleLower = (warn.title || '').toLowerCase();
      const descLower = (warn.desc || '').toLowerCase();
      if (
        titleLower.includes('login') || descLower.includes('login') ||
        titleLower.includes('device') || descLower.includes('device') ||
        titleLower.includes('screen') || descLower.includes('screen') ||
        titleLower.includes('mobile') || descLower.includes('mobile') ||
        titleLower.includes('resolution') || descLower.includes('resolution')
      ) {
        return false;
      }
    }
    return true;
  }).length;

  if (!isAuthenticated) {
    return (
      <div 
        className="min-h-screen bg-bg text-ink relative transition-all"
        style={{
          '--scrollbar-color': scrollbarColors.color,
          '--scrollbar-hover-color': scrollbarColors.hover
        } as React.CSSProperties}
      >
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return (
    <div 
      className={`stoneflow ${theme === 'dark' ? 'dark' : ''}`}
      style={{
        '--scrollbar-color': scrollbarColors.color,
        '--scrollbar-hover-color': scrollbarColors.hover
      } as React.CSSProperties}
    >
      <div className="app">
        {/* Sidebar: Desktop */}
        <div className="hidden md:block h-screen sticky top-0 flex-shrink-0 z-40">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            workspace={workspace}
            onWorkspaceChange={handleWorkspaceChange}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            currentUser={currentUser}
            warningsCount={displayWarningsCount}
            invoiceCount={activeInvoicesCount}
            theme={theme}
            onThemeToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            onLogout={handleLogout}
          />
        </div>

        {/* Sidebar Overlay: Mobile drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div 
              className="backdrop show"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-sidebg border-r border-zinc-800 animate-slide-in">
              <Sidebar
                collapsed={false}
                className="open"
                onToggleCollapse={() => setMobileMenuOpen(false)}
                workspace={workspace}
                onWorkspaceChange={handleWorkspaceChange}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                currentUser={currentUser}
                warningsCount={displayWarningsCount}
                invoiceCount={activeInvoicesCount}
                theme={theme}
                onThemeToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                onLogout={handleLogout}
              />
              {/* Close Mobile Drawer */}
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 hover:bg-zinc-800/40 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="mainc">
          {/* Navigation Topbar Header */}
          <Header
            workspace={workspace}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            currentUser={currentUser}
            onUserChange={handleUserChange}
            usersList={allUsers}
            theme={theme}
            onThemeToggle={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            warningsCount={displayWarningsCount}
            invoiceCount={activeInvoicesCount}
            onLogout={handleLogout}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            onScanQRClick={openQRScanner}
            notificationsEnabled={notificationsEnabled}
            onToggleNotifications={handleToggleNotifications}
            actionLogs={actionLogs}
            onClearActionLogs={handleClearActionLogs}
          />

          {/* Workspace Canvas Container */}
          <div className="content">
            {renderCurrentPage()}
          </div>
        </div>
      </div>

      {/* Toast Overlay Notification Banner with Toggle */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-[200] max-w-md w-full sm:w-[420px] bg-paper dark:bg-zinc-900 border border-line rounded-2xl shadow-2xl p-4 animate-scale-in flex flex-col gap-2.5 text-ink select-none">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-2 rounded-xl flex-shrink-0 flex items-center justify-center text-white ${
                toastType === 'delete' ? 'bg-red-500 shadow-red-500/30' :
                toastType === 'create' ? 'bg-emerald-500 shadow-emerald-500/30' :
                toastType === 'ai' ? 'bg-purple-600 shadow-purple-500/30' :
                toastType === 'update' ? 'bg-sky-500 shadow-sky-500/30' :
                toastIsWarn ? 'bg-amber-500 shadow-amber-500/30' : 'bg-zinc-700'
              } shadow-md`}>
                {toastType === 'delete' ? <Trash2 className="w-4 h-4" /> :
                 toastType === 'create' ? <Plus className="w-4 h-4" /> :
                 toastType === 'ai' ? <Sparkles className="w-4 h-4" /> :
                 toastType === 'update' ? <CheckCircle2 className="w-4 h-4" /> :
                 toastIsWarn ? <AlertTriangle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider ${
                    toastType === 'delete' ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20' :
                    toastType === 'create' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                    toastType === 'ai' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20' :
                    toastType === 'update' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20' :
                    'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20'
                  }`}>
                    {toastType === 'delete' ? 'Delete Done' :
                     toastType === 'create' ? 'Job / Record Create' :
                     toastType === 'ai' ? 'AI Write Job' :
                     toastType === 'update' ? 'Update & Sync' : 'Completed'}
                  </span>
                  <span className="text-[10px] text-mut font-mono">Just now</span>
                </div>
                <p className="text-xs font-semibold leading-snug text-ink mt-1 break-words">
                  {toastMsg}
                </p>
              </div>
            </div>

            <button 
              onClick={() => setToastMsg(null)}
              className="text-mut hover:text-ink p-1 hover:bg-soft rounded-lg transition-colors flex-shrink-0"
              title="Dismiss Notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Toggle control bar inside the toast banner */}
          <div className="flex items-center justify-between pt-2 border-t border-line text-[10px] text-mut">
            <span className="flex items-center gap-1.5 font-medium">
              <Bell className="w-3 h-3 text-sap" />
              Action Notifications
            </span>
            <button
              type="button"
              onClick={() => handleToggleNotifications(false)}
              className="px-2 py-0.5 bg-soft hover:bg-line text-ink rounded font-bold text-[9px] uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
              title="Mute future popups (logs stay saved in bell drawer)"
            >
              Mute Popups 🔕
            </button>
          </div>
        </div>
      )}

      {/* Global QR Code Scanner & Generator Modal */}
      <QRModal
        isOpen={globalQRState.isOpen}
        onClose={() => setGlobalQRState(prev => ({ ...prev, isOpen: false }))}
        mode={globalQRState.mode}
        targetType={globalQRState.targetType}
        targetId={globalQRState.targetId}
        payload={globalQRState.payload}
        onScanResult={(type, id) => {
          setGlobalQRState(prev => ({ ...prev, isOpen: false }));
          if (id && typeof id === 'string' && (type === 'job' || id.startsWith('SF-'))) {
            const rawId = id.replace('SF-', '');
            handlePageChange(`job-${rawId}`);
            triggerToast(`Jumped to scanned Job File: ${id}`, false);
          } else {
            triggerToast(`Scanned ${type ? type.toUpperCase() : 'Unknown'}: ${id || ''}`, false);
          }
        }}
      />

      {/* Global Photo Capture & Upload Modal */}
      <PhotoUploadModal
        isOpen={globalPhotoState.isOpen}
        onClose={() => setGlobalPhotoState(prev => ({ ...prev, isOpen: false }))}
        jobId={globalPhotoState.jobId}
        category={globalPhotoState.category}
        onUploadSuccess={(photo) => {
          // Trigger data reload so everything is fresh
          loadData();
          triggerToast(`Photo uploaded successfully: ${photo.filename}`, false);
        }}
      />

      {/* Quick Edit Material / Remnant Modal */}
      <QuickEditMaterialModal
        isOpen={quickEditItem !== null}
        onClose={() => setQuickEditItem(null)}
        item={quickEditItem}
        onSave={handleQuickEditSave}
        onDelete={handleQuickEditDelete}
      />

      {/* Mobile Bottom Navigation Bar (Fixed to bottom, responsive, beautiful) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-paper/90 backdrop-blur-md border-t border-line flex justify-around items-center z-40 shadow-xl px-2 pb-safe">
        {currentUser.role === 'factory' ? (
          <>
            <button
              onClick={() => handlePageChange('cutting-queue')}
              className={`flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                currentPage === 'cutting-queue' ? 'text-sap' : 'text-mut'
              }`}
            >
              <Scissors className="w-5 h-5" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Cutting</span>
            </button>

            <button
              onClick={() => handlePageChange('qc-station')}
              className={`flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                currentPage === 'qc-station' ? 'text-em' : 'text-mut'
              }`}
            >
              <ClipboardCheck className="w-5 h-5" />
              <span className="text-[9px] font-bold uppercase tracking-wider">QC Station</span>
            </button>
          </>
        ) : currentUser.role === 'installer' ? (
          <>
            <button
              onClick={() => handlePageChange('installations')}
              className={`flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                currentPage === 'installations' ? 'text-sap' : 'text-mut'
              }`}
            >
              <MapPin className="w-5 h-5" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Install</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handlePageChange('dashboard')}
              className={`flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                currentPage === 'dashboard' ? 'text-sap' : 'text-mut'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Dashboard</span>
            </button>

            <button
              onClick={() => handlePageChange('all-jobs')}
              className={`flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                currentPage === 'all-jobs' ? 'text-sap' : 'text-mut'
              }`}
            >
              <ListTodo className="w-5 h-5" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Jobs</span>
            </button>

            {currentUser.role === 'owner' && (
              <button
                onClick={() => handlePageChange('warnings')}
                className={`flex flex-col items-center gap-1.5 relative transition-colors cursor-pointer ${
                  currentPage === 'warnings' ? 'text-ruby' : 'text-mut'
                }`}
              >
                <Bell className="w-5 h-5" />
                {displayWarningsCount > 0 && (
                  <span className="absolute top-0 right-1 w-2 h-2 bg-ruby rounded-full" />
                )}
                <span className="text-[9px] font-bold uppercase tracking-wider">Warnings</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
