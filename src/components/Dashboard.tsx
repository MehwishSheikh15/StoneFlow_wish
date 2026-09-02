import React from 'react';
import { 
  DollarSign, 
  Layers, 
  MapPin, 
  AlertTriangle, 
  ArrowRight, 
  Clock, 
  Lock,
  CheckCircle2,
  Calendar,
  Zap,
  Activity,
  Plus,
  Users,
  Coins,
  FileText,
  Search,
  X
} from 'lucide-react';
import { Job, Material, WarningItem, Installation, ActivityLog, User } from '../types';
import { getPhaseByStage, PRIORITY_THRESHOLDS, STAGES } from '../lib/dbSync';
import { useCurrency } from '../lib/currency';

interface DashboardProps {
  jobs: Job[];
  materials: Material[];
  warnings: WarningItem[];
  activities: ActivityLog[];
  onPageChange: (page: string) => void;
  onJobSelect: (jobId: string) => void;
  currentUser?: User;
}

export const Dashboard: React.FC<DashboardProps> = ({
  jobs,
  materials,
  warnings,
  activities,
  onPageChange,
  onJobSelect,
  currentUser
}) => {
  const { currency: selectedCurrencyCode, setCurrency: handleCurrencyChange, format: formatCurrencyValue } = useCurrency();
  const [showCurrencyDropdown, setShowCurrencyDropdown] = React.useState(false);

  // 1. Calculate KPI Metrics
  const activeJobs = jobs.filter(j => j.current_stage < 17);
  const totalPipelineVal = activeJobs.reduce((sum, j) => sum + j.value, 0);
  const inProductionCount = activeJobs.filter(j => j.current_stage >= 8 && j.current_stage <= 12).length;
  
  // Installations today
  const installationsCount = activeJobs.filter(j => j.current_stage === 13 || j.current_stage === 14).length;
  
  // Urgent priority count
  const urgentCount = activeJobs.filter(j => j.priority === 'urgent').length;
  const warningsCount = warnings.length;

  // 2. Define Phase columns mapping
  const boardPhases = [
    { name: 'Sales', label: 'Sales Pipeline', range: [1, 4], color: 'bg-indigo-600/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20' },
    { name: 'Design', label: 'Design & Approval', range: [5, 7], color: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20' },
    { name: 'Production', label: 'In Factory', range: [8, 12], color: 'bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
    { name: 'Installation', label: 'Install', range: [13, 14], color: 'bg-teal-600/10 text-teal-700 dark:text-teal-400 border-teal-500/20' },
    { name: 'Accounts', label: 'Billing & Closed', range: [15, 17], color: 'bg-slate-600/10 text-slate-700 dark:text-slate-400 border-slate-500/20' }
  ];

  // Map priority colors
  const priorityColors = {
    urgent: { bg: 'bg-rubysoft', text: 'text-ruby', dot: 'bg-ruby' },
    high: { bg: 'bg-amsoft', text: 'text-am', dot: 'bg-am' },
    normal: { bg: 'bg-slatesoft', text: 'text-slate', dot: 'bg-slate' },
    low: { bg: 'bg-emsoft', text: 'text-em', dot: 'bg-em' }
  };

  // Helper to check idle days and SLA status
  const getIdleDays = (lastActivity: string): number => {
    const past = new Date(lastActivity).getTime();
    const now = new Date('2026-07-02T11:58:23-07:00').getTime(); // System time
    return Math.floor(Math.abs(now - past) / (1000 * 60 * 60 * 24));
  };

  // 3. Live Sync status and Interactive Recent Activity states
  const [actSearchQuery, setActSearchQuery] = React.useState('');
  const [actFilter, setActFilter] = React.useState<'all' | 'stages' | 'cad' | 'approvals' | 'warnings'>('all');
  const [actVisibleCount, setActVisibleCount] = React.useState(5);

  // Helper to format activity log timestamp relatively
  const formatLogTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const now = new Date('2026-07-21T05:27:50-07:00'); // Consistent with system time context
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Filter activities
  const filteredActivities = React.useMemo(() => {
    return activities.filter(log => {
      // 1. Filter by category
      const actionLower = (log.action || '').toLowerCase();
      
      if (actFilter === 'stages') {
        const isStage = actionLower.includes('stage') || actionLower.includes('transition') || actionLower.includes('created at') || actionLower.includes('imported');
        if (!isStage) return false;
      } else if (actFilter === 'cad') {
        const isCad = actionLower.includes('drawing') || actionLower.includes('document') || actionLower.includes('uploaded') || actionLower.includes('photo') || actionLower.includes('cad');
        if (!isCad) return false;
      } else if (actFilter === 'approvals') {
        const isApproval = actionLower.includes('approval') || actionLower.includes('approved') || actionLower.includes('reconciled');
        if (!isApproval) return false;
      } else if (actFilter === 'warnings') {
        const isWarn = actionLower.includes('blocked') || actionLower.includes('warning') || actionLower.includes('violation') || actionLower.includes('rejected');
        if (!isWarn) return false;
      }

      // 2. Filter by search query
      if (actSearchQuery.trim()) {
        const query = actSearchQuery.toLowerCase();
        const matchedJob = jobs.find(j => j.id === log.job_id);
        const clientName = matchedJob?.client_name?.toLowerCase() || '';
        const jobType = matchedJob?.job_type?.toLowerCase() || '';
        const userName = (log.user_name || '').toLowerCase();
        const jobId = (log.job_id || '').toLowerCase();
        const action = actionLower;

        return (
          userName.includes(query) ||
          jobId.includes(query) ||
          action.includes(query) ||
          clientName.includes(query) ||
          jobType.includes(query)
        );
      }

      return true;
    });
  }, [activities, actFilter, actSearchQuery, jobs]);

  // Paginated activities
  const displayLogs = filteredActivities.slice(0, actVisibleCount);

  return (
    <div className="space-y-8 animate-fade-in select-none">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-disp font-bold text-ink tracking-tight leading-none">
            Good morning, {currentUser?.name ? currentUser.name.split(' ')[0] : 'Mehwish'}
          </h1>
          <p className="text-sm text-mut mt-1.5">
            {activeJobs.length} active jobs • {urgentCount} urgent priorities {currentUser?.role !== 'owner' && `• ${warningsCount} alerts need attention`}
          </p>
        </div>
        
        {/* Owner Currency Switcher & Navigation Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {currentUser?.role !== 'owner' && (
            <button 
              onClick={() => onPageChange('warnings')}
              className="px-4 py-2.5 bg-paper text-ink font-semibold rounded-xl text-sm border border-line hover:border-mut hover:shadow-sm transition-all flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-am" />
              Warnings Feed
            </button>
          )}

          {currentUser?.role === 'owner' && (
            <div className="relative">
              <button 
                onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                className="px-3.5 py-2.5 bg-paper text-ink font-semibold rounded-xl text-sm border border-line hover:border-mut hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                title="Convert Currency"
              >
                <Coins className="w-4.5 h-4.5 text-sap" />
                <span className="text-xs text-ink font-extrabold uppercase">{selectedCurrencyCode}</span>
              </button>
              
              {showCurrencyDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowCurrencyDropdown(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-paper border border-line rounded-xl shadow-lg py-2 z-50 animate-scale-in">
                    <div className="px-3 py-1 text-[10px] font-bold text-mut uppercase tracking-wider border-b border-line mb-1">
                      Select Currency
                    </div>
                    {[
                      { code: 'gbp', label: 'UK (£ GBP)' },
                      { code: 'usd', label: 'USA ($ USD)' },
                      { code: 'eur', label: 'Europe (€ EUR)' },
                      { code: 'aud', label: 'Australia (A$ AUD)' }
                    ].map((item) => (
                      <button
                        key={item.code}
                        onClick={() => {
                          handleCurrencyChange(item.code);
                          setShowCurrencyDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors flex items-center justify-between ${
                          selectedCurrencyCode === item.code ? 'text-sap bg-sap/5' : 'text-ink'
                        }`}
                      >
                        <span>{item.label}</span>
                        {selectedCurrencyCode === item.code && (
                          <span className="w-1.5 h-1.5 rounded-full bg-sap" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <button 
            onClick={() => onPageChange('create-job')}
            className="px-4 py-2.5 bg-sidebg text-white font-semibold rounded-xl text-sm hover:opacity-90 hover:shadow-lg transition-all flex items-center gap-2 dark:bg-zinc-200 dark:text-black"
          >
            <Plus className="w-4 h-4" />
            New Job
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Pipeline / Active Jobs (role-based) */}
        {currentUser?.role === 'owner' ? (
          <div className="bg-paper border border-line p-5 rounded-2xl relative shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in">
            <div className="absolute left-0 top-4 bottom-4 w-1 bg-sap rounded-r" />
            <div className="flex items-center gap-2 text-xs font-semibold text-mut">
              <DollarSign className="w-4.5 h-4.5 text-sap" />
              Active Pipeline Value
            </div>
            <div className="text-3xl font-disp font-extrabold text-ink tracking-tight mt-3 tnum">
              {formatCurrencyValue(totalPipelineVal, true)}
            </div>
            <p className="text-[11px] text-mut font-semibold mt-1.5 uppercase">
              across {activeJobs.length} live contracts
            </p>
          </div>
        ) : (
          <div className="bg-paper border border-line p-5 rounded-2xl relative shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in">
            <div className="absolute left-0 top-4 bottom-4 w-1 bg-sap rounded-r" />
            <div className="flex items-center gap-2 text-xs font-semibold text-mut">
              <Layers className="w-4.5 h-4.5 text-sap" />
              Active Jobs
            </div>
            <div className="text-3xl font-disp font-extrabold text-ink tracking-tight mt-3 tnum">
              {activeJobs.length}
            </div>
            <p className="text-[11px] text-mut font-semibold mt-1.5 uppercase">
              currently in pipeline
            </p>
          </div>
        )}

        {/* Card 2: In Production */}
        <div className="bg-paper border border-line p-5 rounded-2xl relative shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute left-0 top-4 bottom-4 w-1 bg-am rounded-r" />
          <div className="flex items-center gap-2 text-xs font-semibold text-mut">
            <Layers className="w-4.5 h-4.5 text-am" />
            In Production
          </div>
          <div className="text-3xl font-disp font-extrabold text-ink tracking-tight mt-3 tnum">
            {inProductionCount}
          </div>
          <p className="text-[11px] text-mut font-semibold mt-1.5 uppercase">
            all client approved
          </p>
        </div>

        {/* Card 3: Today's Installations */}
        <div className="bg-paper border border-line p-5 rounded-2xl relative shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="absolute left-0 top-4 bottom-4 w-1 bg-em rounded-r" />
          <div className="flex items-center gap-2 text-xs font-semibold text-mut">
            <MapPin className="w-4.5 h-4.5 text-em" />
            Installations Today
          </div>
          <div className="text-3xl font-disp font-extrabold text-ink tracking-tight mt-3 tnum">
            {installationsCount}
          </div>
          <p className="text-[11px] text-mut font-semibold mt-1.5 uppercase">
            Tom J. dispatched on route
          </p>
        </div>

        {/* Card 4: Open Warnings or Active Team Size (for owner, removing warnings) */}
        {currentUser?.role === 'owner' ? (
          <div className="bg-paper border border-line p-5 rounded-2xl relative shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in">
            <div className="absolute left-0 top-4 bottom-4 w-1 bg-em rounded-r" />
            <div className="flex items-center gap-2 text-xs font-semibold text-mut">
              <Users className="w-4.5 h-4.5 text-em" />
              Active Team Size
            </div>
            <div className="text-3xl font-disp font-extrabold text-ink tracking-tight mt-3 tnum">
              5
            </div>
            <p className="text-[11px] text-mut font-semibold mt-1.5 uppercase">
              members registered
            </p>
          </div>
        ) : (
          <div className="bg-paper border border-line p-5 rounded-2xl relative shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="absolute left-0 top-4 bottom-4 w-1 bg-ruby rounded-r" />
            <div className="flex items-center gap-2 text-xs font-semibold text-mut">
              <AlertTriangle className="w-4.5 h-4.5 text-ruby" />
              Open Alerts
            </div>
            <div className="text-3xl font-disp font-extrabold text-ink tracking-tight mt-3 tnum">
              {warningsCount}
            </div>
            <p className="text-[11px] text-mut font-semibold mt-1.5 uppercase">
              1 hard block gate violation
            </p>
          </div>
        )}
      </div>

      {/* Production Line Board columns */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-disp font-bold tracking-tight text-ink">
            Production line — jobs by phase
          </h2>
          <button 
            onClick={() => onPageChange('all-jobs')}
            className="text-xs font-bold text-sap hover:opacity-85 transition-opacity flex items-center gap-1.5"
          >
            Open full list
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {boardPhases.map((phase) => {
            // Find jobs in this phase
            let phaseJobs = activeJobs.filter(j => j.current_stage >= phase.range[0] && j.current_stage <= phase.range[1]);
            
            // Sort jobs: Urgent first, then highest value or most recently active
            phaseJobs = [...phaseJobs].sort((a, b) => {
              if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
              if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
              return getIdleDays(b.last_activity_at) - getIdleDays(a.last_activity_at);
            });

            return (
              <div key={phase.name} className="bg-soft/75 border border-line rounded-2xl flex flex-col min-h-[360px] max-h-[500px]">
                {/* Column Header */}
                <div className="p-4 border-b border-line bg-paper rounded-t-2xl">
                  <div className="flex items-center gap-2 text-xs font-disp font-bold text-ink">
                    <span className="w-2.5 h-2.5 rounded bg-sap" />
                    {phase.label}
                  </div>
                  <div className="flex justify-between items-center mt-2.5">
                    <span className="text-sm font-disp font-extrabold text-ink">{phaseJobs.length}</span>
                  </div>
                </div>

                {/* Column Cards */}
                <div className="p-2 flex-1 overflow-y-auto space-y-2 scrollbar-thin">
                  {phaseJobs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-mut font-medium">
                      No jobs
                    </div>
                  ) : (
                    phaseJobs.map(job => {
                      const idleDays = getIdleDays(job.last_activity_at);
                      const isStale = idleDays > (PRIORITY_THRESHOLDS[job.priority] || 7);
                      const isLocked = !job.client_approved_at && job.current_stage >= 5; // locks drawings or prod if stage >=5
                      const stageName = STAGES.find(s => s.n === job.current_stage)?.name || '';

                      return (
                        <div
                          key={job.id}
                          onClick={() => onJobSelect(job.id)}
                          className="bg-paper border border-line rounded-xl p-3 cursor-pointer shadow-sm hover:border-mut hover:shadow-md hover:translate-y-[-1px] transition-all relative group"
                        >
                          {/* Priority and ID */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`w-2 h-2 rounded-full ${priorityColors[job.priority].dot}`} />
                            <span className="text-[10px] font-disp font-bold text-mut">{job.id}</span>
                            
                            {isStale && (
                              <span className="ml-auto text-[9px] font-bold text-ruby flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {idleDays}d idle
                              </span>
                            )}
                          </div>

                          {/* Client and project type */}
                          <div className="text-sm font-bold text-ink leading-snug truncate group-hover:text-sap transition-colors">
                            {job.client_name}
                          </div>
                          <div className="text-xs text-mut truncate mt-0.5">
                            {job.job_type}
                          </div>

                          {/* Card Footer */}
                          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-soft">
                            <div className="w-5 h-5 rounded bg-zinc-800 text-white flex items-center justify-center font-disp font-extrabold text-[9px]">
                              {job.assigned_to === 'u-3' ? 'RK' : job.assigned_to === 'u-2' ? 'SM' : 'HN'}
                            </div>
                            <span className="text-[10px] text-zinc-500 font-semibold uppercase truncate">
                              {stageName}
                            </span>
                            {isLocked && (
                              <Lock className="w-3.5 h-3.5 text-ruby ml-auto" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Attention needed (Warnings), Installs, Materials, Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Span: Attention Needed Warnings or High Priority Pipeline (7 column grid span, removing warnings if owner) */}
        {currentUser?.role === 'owner' ? (
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-disp font-bold tracking-tight text-ink">
                High Priority Pipeline
              </h3>
              <button 
                onClick={() => onPageChange('all-jobs')}
                className="text-xs font-bold text-sap hover:opacity-85 transition-opacity flex items-center gap-1"
              >
                All Jobs
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {activeJobs.length === 0 ? (
                <div className="bg-paper border border-line p-8 rounded-2xl text-center shadow-sm">
                  <CheckCircle2 className="w-8 h-8 text-em mx-auto mb-2" />
                  <h4 className="font-disp font-bold text-ink">All clear</h4>
                  <p className="text-xs text-mut mt-1">No active contracts in pipeline.</p>
                </div>
              ) : (
                activeJobs.slice(0, 3).map(job => (
                  <div 
                    key={job.id}
                    onClick={() => onJobSelect(job.id)}
                    className="bg-paper border border-line rounded-2xl p-4 cursor-pointer shadow-sm hover:shadow-md hover:translate-x-1 transition-all flex items-start gap-4 relative overflow-hidden"
                  >
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-sap" />
                    <div className="p-2.5 rounded-xl flex-shrink-0 bg-sap/10 text-sap">
                      <Zap className="w-5 h-5" />
                    </div>

                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-ink">{job.client_name}</h4>
                        <span className="text-xs text-mut font-disp font-bold ml-auto">{job.id}</span>
                      </div>
                      <p className="text-xs text-mut mt-1.5 leading-relaxed truncate">
                        {job.job_type} · {formatCurrencyValue(job.value)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-disp font-bold tracking-tight text-ink">
                Attention needed
              </h3>
              <button 
                onClick={() => onPageChange('warnings')}
                className="text-xs font-bold text-sap hover:opacity-85 transition-opacity flex items-center gap-1"
              >
                All warnings
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {warnings.length === 0 ? (
                <div className="bg-paper border border-line p-8 rounded-2xl text-center shadow-sm">
                  <CheckCircle2 className="w-8 h-8 text-em mx-auto mb-2" />
                  <h4 className="font-disp font-bold text-ink">All clear</h4>
                  <p className="text-xs text-mut mt-1">No open warnings. The automated monitor keeps watching in the background.</p>
                </div>
              ) : (
                warnings.slice(0, 3).map(warn => (
                  <div 
                    key={warn.id}
                    onClick={() => onJobSelect(warn.job_id)}
                    className="bg-paper border border-line rounded-2xl p-4 cursor-pointer shadow-sm hover:shadow-md hover:translate-x-1 transition-all flex items-start gap-4 relative overflow-hidden"
                  >
                    {/* Severity color bar */}
                    <span className={`absolute left-0 top-0 bottom-0 w-1 ${
                      warn.severity === 'block' ? 'bg-ruby' : warn.severity === 'warn' ? 'bg-am' : 'bg-slate-500'
                    }`} />

                    {/* Icon wrapper */}
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                      warn.severity === 'block' ? 'bg-rubysoft text-ruby' : 'bg-amsoft text-am'
                    }`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>

                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-ink">{warn.title}</h4>
                        <span className="text-xs text-mut font-disp font-bold ml-auto">{warn.job_id}</span>
                      </div>
                      <p className="text-xs text-mut mt-1.5 leading-relaxed truncate">
                        {warn.desc}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Right Span: Multi-widgets panel (5 columns span) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Today's Installations */}
          <div className="bg-paper border border-line p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-disp font-bold text-ink uppercase tracking-wider">
                Today's Installations
              </h4>
              <button 
                onClick={() => onPageChange('installations')}
                className="text-xs font-semibold text-sap hover:opacity-85 transition-opacity"
              >
                Schedule
              </button>
            </div>

            <div className="space-y-3">
              {activeJobs.filter(j => j.current_stage === 13 || j.current_stage === 14).length === 0 ? (
                <p className="text-xs text-mut py-3 text-center">No installations scheduled for today.</p>
              ) : (
                activeJobs
                  .filter(j => j.current_stage === 13 || j.current_stage === 14)
                  .map((j, idx) => (
                    <div key={j.id} className="flex items-center justify-between py-2.5 border-b border-soft last:border-b-0">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-em" />
                        <div>
                          <div className="text-sm font-bold text-ink leading-tight">{j.client_name}</div>
                          <div className="text-[11px] text-mut mt-0.5">{j.site_address.split(',')[0]}</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded ${
                        j.current_stage === 14 ? 'bg-emsoft text-em' : 'bg-amsoft text-am'
                      }`}>
                        {j.current_stage === 14 ? 'On Site' : 'Scheduled'}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Material Availability Widget */}
          <div className="bg-paper border border-line p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-disp font-bold text-ink uppercase tracking-wider">
                Material availability
              </h4>
              <button 
                onClick={() => onPageChange('materials')}
                className="text-xs font-semibold text-sap hover:opacity-85 transition-opacity"
              >
                Inventory
              </button>
            </div>

            <div className="space-y-3">
              {materials.slice(0, 4).map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-b border-soft last:border-b-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-10 h-10 rounded-lg bg-cover bg-center border border-line flex-shrink-0"
                      style={{ 
                        backgroundColor: m.color === 'Calacatta Gold' ? '#E9E2D2' : m.color === 'Nero Marquina' ? '#26262B' : '#EBEAE7' 
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-ink truncate">{m.color}</div>
                      <div className="text-[11px] text-mut truncate mt-0.5">{m.brand} • {m.slab_id}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded ${
                    m.available ? 'bg-emsoft text-em' : 'bg-rubysoft text-ruby'
                  }`}>
                    {m.available ? 'Free' : 'Allocated'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Recent Activity Feed Panel */}
          <div className="bg-paper border border-line p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-disp font-bold text-ink uppercase tracking-wider">
                Recent activity
              </h4>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-em">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-em opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-em"></span>
                </span>
                Express DB Synced
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search updates, users, clients..."
                value={actSearchQuery}
                onChange={(e) => {
                  setActSearchQuery(e.target.value);
                  setActVisibleCount(5);
                }}
                className="w-full pl-8 pr-7 py-1.5 bg-soft/50 border border-line rounded-lg text-xs font-semibold text-ink focus:outline-none focus:border-sap placeholder-zinc-400"
              />
              {actSearchQuery && (
                <button
                  onClick={() => setActSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-ink cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1 border-b border-soft pb-3">
              {[
                { id: 'all', label: 'All Actions' },
                { id: 'stages', label: 'Stages' },
                { id: 'cad', label: 'CAD & Files' },
                { id: 'approvals', label: 'Approvals' },
                { id: 'warnings', label: 'Alerts' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActFilter(tab.id as any);
                    setActVisibleCount(5);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    actFilter === tab.id
                      ? 'bg-sap text-white shadow-xs'
                      : 'bg-soft text-mut hover:text-ink hover:bg-muted'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Activity List Container */}
            <div className="space-y-4">
              {displayLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-mut font-semibold space-y-2">
                  <p>No activity logs found matching the filters.</p>
                  {(actSearchQuery || actFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setActSearchQuery('');
                        setActFilter('all');
                      }}
                      className="text-[11px] text-sap font-bold underline"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                displayLogs.map((log) => {
                  const actionLower = (log.action || '').toLowerCase();
                  
                  // Category detection for beautiful styling
                  const isStage = actionLower.includes('stage') || actionLower.includes('transition') || actionLower.includes('created at') || actionLower.includes('imported');
                  const isCad = actionLower.includes('drawing') || actionLower.includes('document') || actionLower.includes('uploaded') || actionLower.includes('photo') || actionLower.includes('cad');
                  const isApproval = actionLower.includes('approval') || actionLower.includes('approved') || actionLower.includes('reconciled');
                  const isWarn = actionLower.includes('blocked') || actionLower.includes('warning') || actionLower.includes('violation') || actionLower.includes('rejected');
                  const isCreated = actionLower.includes('created');

                  // Style definitions
                  let iconBg = 'bg-zinc-500/10 border-zinc-500/10';
                  let icon = <Activity className="w-3.5 h-3.5 text-mut" />;

                  if (isWarn) {
                    iconBg = 'bg-rubysoft border-ruby/10';
                    icon = <AlertTriangle className="w-3.5 h-3.5 text-ruby" />;
                  } else if (isApproval) {
                    iconBg = 'bg-emsoft border-em/10';
                    icon = <CheckCircle2 className="w-3.5 h-3.5 text-em" />;
                  } else if (isCad) {
                    iconBg = 'bg-sap/10 border-sap/10';
                    icon = <FileText className="w-3.5 h-3.5 text-sap" />;
                  } else if (isStage) {
                    iconBg = 'bg-indigo-600/10 border-indigo-500/10';
                    icon = <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
                  } else if (isCreated) {
                    iconBg = 'bg-sky-600/10 border-sky-500/10';
                    icon = <Plus className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />;
                  }

                  const matchedJob = jobs.find(j => j.id === log.job_id);

                  return (
                    <div 
                      key={log.id} 
                      onClick={() => onJobSelect(log.job_id)}
                      className="flex items-start gap-3 p-2.5 -mx-2.5 rounded-xl hover:bg-soft/40 transition-all cursor-pointer group border border-transparent hover:border-line"
                    >
                      {/* Icon wrapper */}
                      <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBg}`}>
                        {icon}
                      </div>

                      {/* Content details */}
                      <div className="flex-grow min-w-0">
                        <p className="text-xs text-ink leading-snug font-medium">
                          <strong className="font-bold text-zinc-900 dark:text-white group-hover:text-sap transition-colors">
                            {log.user_name}
                          </strong>{' '}
                          {log.action}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] font-disp font-black bg-soft px-1.5 py-0.5 rounded text-mut">
                            {log.job_id}
                          </span>
                          
                          {matchedJob && (
                            <span className="text-[10px] font-bold text-sap max-w-[120px] truncate">
                              • {matchedJob.client_name}
                            </span>
                          )}

                          <span className="text-[10px] text-zinc-400 font-medium ml-auto">
                            {formatLogTime(log.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {filteredActivities.length > actVisibleCount && (
              <button
                onClick={() => setActVisibleCount(prev => Math.min(prev + 5, filteredActivities.length))}
                className="w-full text-center py-2.5 text-[11px] font-extrabold text-sap bg-sap/5 border border-sap/10 rounded-xl hover:bg-sap/10 transition-colors mt-2 cursor-pointer"
              >
                Load older activities ({filteredActivities.length - actVisibleCount} remaining)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
