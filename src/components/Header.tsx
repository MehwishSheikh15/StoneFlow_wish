import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  Search, 
  Sun, 
  Moon, 
  Bell, 
  Plus, 
  CornerDownLeft,
  X,
  FileText,
  Layers,
  MapPin,
  LayoutDashboard,
  Building,
  Factory,
  Database,
  ArrowLeftRight,
  QrCode,
  ChevronDown,
  Users,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Receipt
} from 'lucide-react';
import { User } from '../types';
import { dbSync as dbMock, STAGES } from '../lib/dbSync';
import { SystemHealth } from './SystemHealth';
import { GlobalSyncIndicator } from './GlobalSyncIndicator';

export interface ActionLogItem {
  id: string;
  title: string;
  message: string;
  type: 'delete' | 'create' | 'ai' | 'update' | 'info';
  time: string;
  isWarn?: boolean;
}

interface HeaderProps {
  workspace: 'office' | 'factory';
  currentPage: string;
  onPageChange: (page: string) => void;
  currentUser: User;
  onUserChange: (user: User) => void;
  usersList: User[];
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  onOpenMobileMenu?: () => void;
  warningsCount: number;
  invoiceCount?: number;
  onLogout?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onScanQRClick?: () => void;
  notificationsEnabled?: boolean;
  onToggleNotifications?: (enabled?: boolean) => void;
  actionLogs?: ActionLogItem[];
  onClearActionLogs?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  workspace,
  currentPage,
  onPageChange,
  currentUser,
  onUserChange,
  usersList,
  theme,
  onThemeToggle,
  onOpenMobileMenu,
  warningsCount,
  invoiceCount = 0,
  onLogout,
  sidebarCollapsed,
  onToggleSidebar,
  onScanQRClick,
  notificationsEnabled = true,
  onToggleNotifications,
  actionLogs = [],
  onClearActionLogs
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  const [showSignoutWarning, setShowSignoutWarning] = useState(() => {
    return localStorage.getItem('sf_show_signout_warn') !== 'false';
  });

  const handleCloseSignoutWarning = () => {
    setShowSignoutWarning(false);
    localStorage.setItem('sf_show_signout_warn', 'false');
  };
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);

  useEffect(() => {
    setJobs(dbMock.getJobs());
    setTeamUsers(dbMock.getUsers());
    
    const unsubscribe = dbMock.subscribe(() => {
      setJobs(dbMock.getJobs());
      setTeamUsers(dbMock.getUsers());
    });
    return unsubscribe;
  }, []);

  // Keyboard shortcut for command search (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle live search
  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }

    const query = searchQuery.trim().toLowerCase();

    const screens = [
      { id: 'dashboard', label: 'Dashboard', type: 'Screen', icon: LayoutDashboard },
      { id: 'all-jobs', label: 'All Jobs', type: 'Screen', icon: FileText },
      { id: 'materials', label: 'Materials', type: 'Screen', icon: Layers },
      { id: 'installations', label: 'Installations', type: 'Screen', icon: MapPin },
      ...(currentUser.role === 'owner' ? [{ id: 'warnings', label: 'Warnings', type: 'Screen', icon: Bell }] : [])
    ];

    if (!query) {
      setSearchResults([
        ...screens.slice(0, 3),
        ...jobs.slice(0, 3).map(j => ({ id: j.id, label: `${j.client_name} - ${j.id}`, sub: j.job_type, type: 'Job', icon: FileText })),
        ...teamUsers.slice(0, 2).map(u => ({ id: u.id || 'team', label: `${u.name} (${u.role.toUpperCase()})`, sub: u.email, type: 'Team', icon: Users }))
      ]);
      return;
    }

    const matchedScreens = screens.filter(s => s.label.toLowerCase().includes(query));
    const matchedJobs = jobs
      .filter(j => (j.id || '').toLowerCase().includes(query) || (j.client_name || '').toLowerCase().includes(query) || (j.job_type || '').toLowerCase().includes(query))
      .map(j => ({
        id: j.id,
        label: `${j.client_name} - ${j.id}`,
        sub: `${j.job_type} (${STAGES.find(s => s.n === j.current_stage)?.name || ''})`,
        type: 'Job',
        icon: FileText
      }));

    const matchedUsers = teamUsers
      .filter(u => (u.name || '').toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query) || (u.role || '').toLowerCase().includes(query))
      .map(u => ({
        id: u.id || 'team',
        label: `${u.name} (${u.role.toUpperCase()})`,
        sub: u.email,
        type: 'Team',
        icon: Users
      }));

    setSearchResults([...matchedScreens, ...matchedJobs, ...matchedUsers]);
  }, [searchQuery, searchOpen, jobs, teamUsers]);

  const handleSelectResult = (result: any) => {
    setSearchOpen(false);
    if (result.type === 'Job') {
      onPageChange(`job-${result.id}`);
    } else if (result.type === 'Team') {
      onPageChange('team');
    } else {
      onPageChange(result.id);
    }
  };

  const pageTitles: { [key: string]: string } = {
    dashboard: 'Dashboard',
    'all-jobs': 'All Jobs',
    warnings: 'Warnings',
    'sales-pipeline': 'Sales Pipeline',
    'design-approval': 'Design & Approval',
    'create-job': 'Create Job',
    materials: 'Materials',
    installations: 'Installations',
    'billing-closed': 'Invoices',
    'cutting-queue': 'Cutting Queue',
    'qc-station': 'QC Station'
  };

  const displayTitle = currentPage.startsWith('job-') 
    ? 'Job Detail' 
    : (pageTitles[currentPage] || 'Workspace');

  return (
    <>
      <header className="top">
        {/* Mobile menu toggle */}
        <button 
          onClick={onOpenMobileMenu}
          className="ibtn menut"
        >
          <span className="icn"><Menu className="w-full h-full" /></span>
        </button>

        {/* Desktop sidebar toggle */}
        {onToggleSidebar && (
          <button 
            onClick={onToggleSidebar}
            className="ibtn deskt hidden md:flex mr-2"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <span className="icn">
              {sidebarCollapsed ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 3v18"/>
                  <path d="m14 9 3 3-3 3"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 3v18"/>
                  <path d="m17 15-3-3 3-3"/>
                </svg>
              )}
            </span>
          </button>
        )}

        {/* Breadcrumb path */}
        <div className="crumbb">
          <span className="cr1 hidden sm:inline">{workspace === 'office' ? 'Office' : 'Factory'} / </span>
          {displayTitle}
        </div>

        {/* Search button trigger */}
        <button 
          onClick={() => setSearchOpen(true)}
          className="searchbtn search-desktop"
        >
          <span className="icn"><Search className="w-full h-full" /></span>
          <span className="truncate">Search jobs, materials, clients…</span>
          <span className="kbd">⌘K</span>
        </button>

        {/* Mobile Search icon button */}
        <button 
          onClick={() => setSearchOpen(true)}
          className="ibtn search-mobile"
          title="Search"
        >
          <span className="icn"><Search className="w-full h-full" /></span>
        </button>

        {/* System Health Status Indicator */}
        <SystemHealth isOnline={true} />

        {/* Theme Toggle */}
        <button 
          onClick={onThemeToggle}
          className="ibtn header-theme-toggle"
        >
          <span className="icn">
            {theme === 'light' ? <Moon className="w-full h-full" /> : <Sun className="w-full h-full" />}
          </span>
        </button>

        {/* Action Notifications & Warnings Bell Trigger */}
        <div className="relative">
          <button 
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="ibtn header-warnings"
            title="Action Notifications & System Health Alerts"
          >
            <span className="icn"><Bell className="w-full h-full" /></span>
            {(warningsCount > 0 || (actionLogs && actionLogs.length > 0)) && (
              <span className={`reddot ${!notificationsEnabled ? 'opacity-50' : ''}`} />
            )}
          </button>

          {/* Action Notifications Center Popover */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-paper border border-line rounded-2xl shadow-2xl z-[110] p-4 animate-fade-in text-ink">
              <div className="flex items-center justify-between border-b border-line pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-sap/10 text-sap rounded-lg">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-disp font-extrabold text-sm tracking-tight text-ink">
                      Action Notifications
                    </h4>
                    <p className="text-[10px] text-mut">Job create, delete done, AI tasks</p>
                  </div>
                </div>
                <button 
                  onClick={() => setNotificationsOpen(false)}
                  className="text-mut hover:text-ink p-1 hover:bg-soft rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Live Toggle Switch Row */}
              <div className="p-3 bg-soft/60 rounded-xl border border-line flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                    {notificationsEnabled ? 'Popups Enabled' : 'Popups Muted'}
                    <span className={`inline-block w-2 h-2 rounded-full ${notificationsEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                  </div>
                  <div className="text-[10px] text-mut leading-tight mt-0.5">
                    {notificationsEnabled ? 'Toast popups appear on screen' : 'Notifications saved to log silently'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleNotifications?.(!notificationsEnabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    notificationsEnabled ? 'bg-sap' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                  title={notificationsEnabled ? 'Mute Action Popups' : 'Enable Action Popups'}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* History / Logs list */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-mut uppercase tracking-wider px-1">
                  <span>Recent Action Logs</span>
                  {actionLogs.length > 0 && onClearActionLogs && (
                    <button
                      onClick={onClearActionLogs}
                      className="text-ruby hover:underline cursor-pointer"
                    >
                      Clear Log
                    </button>
                  )}
                </div>

                {actionLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-mut bg-soft/30 rounded-xl border border-dashed border-line">
                    No recent completed action notifications.
                  </div>
                ) : (
                  actionLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="p-2.5 bg-paper hover:bg-soft/50 border border-line rounded-xl text-xs space-y-1 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          log.type === 'delete' ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                          log.type === 'create' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                          log.type === 'ai' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
                          log.type === 'update' ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400' :
                          'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400'
                        }`}>
                          {log.type === 'delete' ? 'Delete Done' :
                           log.type === 'create' ? 'Job Create' :
                           log.type === 'ai' ? 'AI Write Job' :
                           log.type === 'update' ? 'Update & Sync' : 'Completed'}
                        </span>
                        <span className="text-[10px] text-mut font-mono">{log.time}</span>
                      </div>
                      <p className="text-[11px] text-ink font-medium leading-snug break-words">
                        {log.message}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {currentUser.role === 'owner' && warningsCount > 0 && (
                <div className="pt-3 border-t border-line mt-3">
                  <button
                    onClick={() => {
                      setNotificationsOpen(false);
                      onPageChange('warnings');
                    }}
                    className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    View System Warnings ({warningsCount})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logout trigger */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="ibtn text-mut hover:text-ruby header-logout"
            title="Log Out"
          >
            <span className="icn">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            </span>
          </button>
        )}

        {/* User initials avatar and settings toggle */}
        <div className="relative">
          <button 
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="sav bg-gradient-to-tr from-zinc-700 to-zinc-950 text-white select-none text-xs font-bold font-disp flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
            title="User Preferences & Settings"
          >
            {currentUser.initials}
          </button>

          {settingsOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-paper border border-line rounded-2xl shadow-2xl z-[110] p-4 animate-fade-in text-ink">
              <div className="flex items-center justify-between border-b border-line pb-3 mb-3">
                <h4 className="font-disp font-extrabold text-sm tracking-tight text-ink">User Preferences</h4>
                <button 
                  onClick={() => setSettingsOpen(false)}
                  className="text-mut hover:text-ink p-1 hover:bg-soft rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* User Info */}
                <div className="bg-soft/45 p-3 rounded-xl border border-line text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-ink">{currentUser.name}</div>
                      <div className="text-mut text-[10px] mt-0.5">{currentUser.email || 'authenticated user'}</div>
                    </div>
                    <span className="px-2 py-0.5 bg-sap/10 text-sap rounded-md font-extrabold text-[9px] uppercase tracking-wider border border-sap/20">
                      {currentUser.role}
                    </span>
                  </div>

                  {/* Switch Active Role / Profile */}
                  <div className="pt-2 border-t border-line/60">
                    <label className="block text-[9px] font-extrabold uppercase tracking-wider text-mut mb-1">
                      {currentUser.id.startsWith('clerk-') ? 'Clerk Synced Role Role:' : 'Switch Role View:'}
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                      {(['owner', 'office', 'factory', 'installer'] as const).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            const updated = { ...currentUser, role };
                            onUserChange(updated);
                          }}
                          className={`py-1 text-[9px] font-bold rounded-lg capitalize transition-all cursor-pointer ${
                            currentUser.role === role
                              ? 'bg-sap text-white shadow-xs'
                              : 'bg-paper text-ink hover:bg-soft border border-line'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Notifications Toggle Preference */}
                <div className="flex items-center justify-between p-3 bg-soft rounded-xl border border-line">
                  <div>
                    <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-sap" />
                      Action Notifications
                    </div>
                    <div className="text-[10px] text-mut mt-0.5">Show popups for job creates, deletes, AI tasks</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleNotifications?.(!notificationsEnabled)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      notificationsEnabled ? 'bg-sap' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notificationsEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Currency Selection Preference */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-mut uppercase tracking-wider">
                    Global Currency Region
                  </label>
                  <select
                    value={localStorage.getItem('stoneflow_currency') || 'gbp'}
                    onChange={(e) => {
                      const newCurrency = e.target.value;
                      localStorage.setItem('stoneflow_currency', newCurrency);
                      window.dispatchEvent(new Event('stoneflow_currency_changed'));
                    }}
                    className="w-full bg-soft border border-line rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none focus:border-mut cursor-pointer"
                  >
                    <option value="gbp">United Kingdom (£ GBP)</option>
                    <option value="usd">United States ($ USD)</option>
                    <option value="eur">Europe (€ EUR)</option>
                    <option value="aud">Australia (A$ AUD)</option>
                  </select>
                </div>

                {/* Additional instructions */}
                <div className="text-[10px] text-mut leading-relaxed border-t border-line pt-3">
                  This preference affects all financial dashboards, job contracts, and logistics valuations in real time.
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {showSignoutWarning && (
        <div className="md:hidden bg-amber-500/10 border-b border-amber-500/20 px-3 py-2 flex items-center justify-between gap-2 text-xs text-ink select-none animate-fade-in">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="p-1 bg-amber-500/20 rounded text-amber-500 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </span>
            <span className="truncate font-medium text-[11px]">
              Signed in as <strong className="font-bold">{currentUser.name}</strong> ({currentUser.role}). Need to sign out?
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onLogout && (
              <button 
                onClick={onLogout}
                className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 font-bold rounded text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            )}
            
            <button
              onClick={onThemeToggle}
              className="p-1 hover:bg-amber-500/20 rounded text-ink/70 hover:text-ink transition-colors cursor-pointer"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleCloseSignoutWarning}
              className="p-1 hover:bg-amber-500/20 rounded text-ink/70 hover:text-ink transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Command Center Modal (Search & Jump) */}
      {searchOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center p-4 pt-16 md:pt-24"
          onClick={() => setSearchOpen(false)}
        >
          <div 
            className="bg-paper border border-line rounded-2xl shadow-2xl w-full max-w-xl h-fit overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-line flex items-center gap-3">
              <Search className="w-5 h-5 text-mut flex-shrink-0" />
              <input 
                ref={searchInputRef}
                type="text" 
                placeholder="Jump to any page, client, or job number..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-grow bg-transparent text-ink placeholder-mut outline-none text-base"
              />
              <button 
                onClick={() => setSearchOpen(false)}
                className="text-mut hover:text-ink p-1 hover:bg-soft rounded-lg"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-2">
              <div className="text-[10px] text-mut uppercase font-bold px-3 py-1.5">
                {searchQuery ? 'Search Results' : 'Recent / Jump Links'}
              </div>

              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-sm text-mut">
                  No matching jobs, clients, or screens found.
                </div>
              ) : (
                <div className="space-y-0.5">
                  {searchResults.map((result, idx) => {
                    const Icon = result.icon || FileText;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectResult(result)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-soft text-ink hover:text-sap transition-all text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-soft flex items-center justify-center text-mut group-hover:text-sap">
                          <Icon className="w-4.5 h-4.5 text-zinc-500" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="font-semibold truncate">{result.label}</div>
                          {result.sub && <div className="text-xs text-mut truncate">{result.sub}</div>}
                        </div>
                        <div className="text-[10px] font-bold text-mut uppercase px-2 py-0.5 bg-soft rounded">
                          {result.type}
                        </div>
                        <CornerDownLeft className="w-3.5 h-3.5 text-mut opacity-0 group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-soft p-3 border-t border-line flex justify-between items-center text-[10px] text-mut font-semibold">
              <span>Use <kbd className="font-mono bg-paper px-1 py-0.5 rounded border border-line">↑↓</kbd> to navigate</span>
              <span><kbd className="font-mono bg-paper px-1 py-0.5 rounded border border-line">Esc</kbd> to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
