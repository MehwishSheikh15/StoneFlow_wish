import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  Users,
  Filter,
  ArrowRight,
  Download,
  Upload,
  Trash2
} from 'lucide-react';
import { Job, User } from '../types';
import { dbSync as dbMock, STAGES, getPhaseByStage, PRIORITY_THRESHOLDS } from '../lib/dbSync';
import { useCurrency } from '../lib/currency';

interface AllJobsProps {
  jobs: Job[];
  onJobSelect: (jobId: string) => void;
  onPageChange: (page: string) => void;
  currentUser?: User;
  onDeleteJob?: (jobId: string) => void;
}

export const AllJobs: React.FC<AllJobsProps> = ({
  jobs,
  onJobSelect,
  onPageChange,
  currentUser,
  onDeleteJob
}) => {
  const { format } = useCurrency();
  const [filter, setFilter] = useState<'all' | 'urgent' | 'stale' | 'production' | 'approval'>('all');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Priority styling
  const priorityStyles = {
    urgent: 'bg-rubysoft text-ruby border-ruby/10',
    high: 'bg-amsoft text-am border-am/10',
    normal: 'bg-slatesoft text-slate border-slate/10',
    low: 'bg-emsoft text-em border-em/10'
  };

  const getIdleDays = (lastActivity: string): number => {
    const past = new Date(lastActivity).getTime();
    const now = new Date('2026-07-02T11:58:23-07:00').getTime();
    return Math.floor(Math.abs(now - past) / (1000 * 60 * 60 * 24));
  };

  // Filter & Search logic
  const filteredJobs = jobs.filter(job => {
    // 1. Filter chips
    if (filter === 'urgent' && job.priority !== 'urgent') return false;
    if (filter === 'stale') {
      const idle = getIdleDays(job.last_activity_at);
      const threshold = PRIORITY_THRESHOLDS[job.priority];
      if (idle <= threshold) return false;
    }
    if (filter === 'production' && (job.current_stage < 8 || job.current_stage > 12)) return false;
    if (filter === 'approval' && (job.current_stage < 5 || job.current_stage > 7 || job.client_approved_at !== null)) return false;

    // 2. Search box
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = (job.client_name || '').toLowerCase().includes(q) || 
                    (job.id || '').toLowerCase().includes(q) || 
                    (job.job_type || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  const handleExportPDF = () => {
    const isOwner = currentUser?.role === 'owner';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = filteredJobs.map(job => {
      const idleDays = getIdleDays(job.last_activity_at);
      const phase = getPhaseByStage(job.current_stage);
      const stageName = STAGES.find(s => s.n === job.current_stage)?.name || '';
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${job.id}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${job.client_name || 'N/A'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${job.job_type || 'N/A'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: 600;">${job.priority.toUpperCase()}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${phase.label} - Stage ${job.current_stage}: ${stageName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${idleDays}d</td>
          ${isOwner ? `<td style="padding: 8px; border-bottom: 1px solid #ddd;">£${(job.value || 0).toLocaleString()}</td>` : ''}
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>StoneFlow CRM - Jobs Report PDF</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1e293b; }
            h1 { margin-bottom: 4px; color: #0f172a; font-size: 20px; }
            p { font-size: 12px; color: #64748b; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
            th { text-align: left; background: #f1f5f9; padding: 10px 8px; border-bottom: 2px solid #cbd5e1; font-weight: 700; color: #334155; }
          </style>
        </head>
        <body>
          <h1>STONEFLOW CRM — Active Jobs Report</h1>
          <p>Generated: ${new Date().toLocaleString()} • Filtered Records: ${filteredJobs.length}</p>
          <table>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Client</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Phase & Stage</th>
                <th>Idle</th>
                ${isOwner ? '<th>Value</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-disp font-extrabold text-ink tracking-tight">All Jobs</h1>
          <p className="text-xs text-mut mt-1">
            {jobs.length} jobs registered • Sorted by priority levels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 bg-paper border border-line text-ink font-semibold rounded-xl text-xs hover:border-mut transition-all flex items-center gap-2 cursor-pointer"
            title="Export current view to PDF Document"
          >
            <Download className="w-4 h-4 text-zinc-500" />
            Export PDF
          </button>
          <button
            onClick={() => onPageChange('create-job')}
            className="px-4 py-2.5 bg-sap text-white font-semibold rounded-xl text-sm hover:opacity-90 hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Job
          </button>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
              filter === 'all' 
                ? 'bg-ink text-white border-ink dark:bg-zinc-200 dark:text-black' 
                : 'bg-paper text-zinc-600 border-line hover:border-mut'
            }`}
          >
            All
            <span className="text-[10px] opacity-70">({jobs.length})</span>
          </button>
          <button
            onClick={() => setFilter('urgent')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
              filter === 'urgent' 
                ? 'bg-ruby text-white border-ruby' 
                : 'bg-paper text-ruby border-line hover:border-ruby/30'
            }`}
          >
            Urgent
            <span className="text-[10px] opacity-70">({jobs.filter(j => j.priority === 'urgent').length})</span>
          </button>
          <button
            onClick={() => setFilter('stale')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
              filter === 'stale' 
                ? 'bg-am text-white border-am' 
                : 'bg-paper text-am border-line hover:border-am/30'
            }`}
          >
            Stale / Idle
            <span className="text-[10px] opacity-70">
              ({jobs.filter(j => getIdleDays(j.last_activity_at) > PRIORITY_THRESHOLDS[j.priority]).length})
            </span>
          </button>
          <button
            onClick={() => setFilter('production')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
              filter === 'production' 
                ? 'bg-amber-600 text-white border-amber-600' 
                : 'bg-paper text-amber-700 border-line hover:border-amber-600/30'
            }`}
          >
            In Factory
            <span className="text-[10px] opacity-70">({jobs.filter(j => j.current_stage >= 8 && j.current_stage <= 12).length})</span>
          </button>
          <button
            onClick={() => setFilter('approval')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
              filter === 'approval' 
                ? 'bg-indigo-600 text-white border-indigo-600' 
                : 'bg-paper text-indigo-700 border-line hover:border-indigo-600/30'
            }`}
          >
            Awaiting Approval
            <span className="text-[10px] opacity-70">
              ({jobs.filter(j => j.current_stage >= 5 && j.current_stage <= 7 && j.client_approved_at === null).length})
            </span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-mut" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-paper border border-line rounded-xl text-sm text-ink focus:outline-none focus:border-sap"
          />
        </div>
      </div>

      {/* Jobs Table Wrapper */}
      <div className="bg-paper border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-soft border-b border-line text-[10px] tracking-widest text-mut uppercase font-semibold text-left">
                <th className="py-3 px-6">Job, Client & Description</th>
                <th className="py-3 px-6">Priority</th>
                <th className="py-3 px-6">Phase & Stage</th>
                <th className="py-3 px-6">Assigned Operator</th>
                <th className="py-3 px-6">SLA Status</th>
                {currentUser?.role === 'owner' && <th className="py-3 px-6 text-right">Contract Value</th>}
                {currentUser?.role === 'owner' && <th className="py-3 px-6 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={currentUser?.role === 'owner' ? 7 : 5} className="py-12 text-center text-sm text-mut">
                    No active jobs matched your criteria.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const idleDays = getIdleDays(job.last_activity_at);
                  const threshold = PRIORITY_THRESHOLDS[job.priority];
                  const isBreached = idleDays > threshold;
                  const phase = getPhaseByStage(job.current_stage);
                  const stageName = STAGES.find(s => s.n === job.current_stage)?.name || '';

                  return (
                    <tr
                      key={job.id}
                      onClick={() => onJobSelect(job.id)}
                      className="border-b border-soft last:border-0 hover:bg-soft/50 cursor-pointer transition-colors"
                    >
                      {/* Job / Client details */}
                      <td className="py-4.5 px-6">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            job.priority === 'urgent' ? 'bg-ruby' : job.priority === 'high' ? 'bg-am' : job.priority === 'normal' ? 'bg-slate-400' : 'bg-em'
                          }`} />
                          <div>
                            <div className="text-sm font-bold text-ink leading-tight hover:text-sap">
                              {job.client_name} <span className="text-xs font-mono font-semibold text-mut ml-1">({job.id})</span>
                            </div>
                            <div className="text-xs text-mut mt-1 font-medium max-w-xs sm:max-w-md line-clamp-2 leading-relaxed">
                              {job.job_description || job.notes || `${job.job_type} • ${job.material || 'Stone Fabrication'} • ${job.site_address}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Priority pill */}
                      <td className="py-4.5 px-6">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${priorityStyles[job.priority]}`}>
                          {job.priority.toUpperCase()}
                        </span>
                      </td>

                      {/* Phase & Stage */}
                      <td className="py-4.5 px-6">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded ${
                            phase.name === 'Sales' ? 'bg-indigo-600' : phase.name === 'Design' ? 'bg-zinc-500' : phase.name === 'Production' ? 'bg-amber-600' : phase.name === 'Installation' ? 'bg-teal-600' : 'bg-slate-600'
                          }`} />
                          <span className="text-xs font-bold text-ink leading-none">{phase.label}</span>
                        </div>
                        <div className="text-[10px] text-mut font-semibold mt-1">
                          {stageName}
                        </div>
                      </td>

                      {/* Assigned operator */}
                      <td className="py-4.5 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-zinc-800 text-white flex items-center justify-center font-disp font-bold text-[10px]">
                            {job.assigned_to === 'u-3' ? 'RK' : job.assigned_to === 'u-2' ? 'SM' : 'MS'}
                          </div>
                          <span className="text-xs text-zinc-600 font-semibold uppercase">
                            {job.assigned_to === 'u-3' ? 'Rashid K.' : job.assigned_to === 'u-2' ? 'Sara M.' : 'Mehwish'}
                          </span>
                        </div>
                      </td>

                      {/* SLA status check */}
                      <td className="py-4.5 px-6">
                        {isBreached ? (
                          <div className="text-xs text-ruby font-bold flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" />
                            {idleDays}d idle (SLA breach)
                          </div>
                        ) : (
                          <div className="text-xs text-em font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            {idleDays}d • on track
                          </div>
                        )}
                      </td>

                      {/* Job value contract amount */}
                      {currentUser?.role === 'owner' && (
                        <td className="py-4.5 px-6 text-right">
                          <span className="text-sm font-disp font-bold text-ink tnum">
                            {format(job.value)}
                          </span>
                        </td>
                      )}

                      {currentUser?.role === 'owner' && (
                        <td className="py-4.5 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                          {confirmDeleteId === job.id ? (
                            <div className="flex items-center justify-center gap-1.5 animate-scale-in">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (onDeleteJob) {
                                    await onDeleteJob(job.id);
                                  }
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 bg-ruby hover:bg-ruby/95 text-white text-[10px] font-extrabold rounded-md transition-all cursor-pointer shadow-sm"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-ink text-[10px] font-semibold rounded-md transition-all cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(job.id);
                              }}
                              className="p-1.5 hover:bg-rubysoft rounded-lg text-ruby transition-all hover:scale-105 cursor-pointer"
                              title="Delete job"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
