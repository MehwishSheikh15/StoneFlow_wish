import React from 'react';
import { GitBranch, Clock, Lock, Plus } from 'lucide-react';
import { Job, User } from '../types';
import { STAGES } from '../lib/dbSync';
import { useCurrency } from '../lib/currency';

interface SalesPipelineProps {
  jobs: Job[];
  onJobSelect: (jobId: string) => void;
  onPageChange: (page: string) => void;
  currentUser: User;
}

export const SalesPipeline: React.FC<SalesPipelineProps> = ({
  jobs,
  onJobSelect,
  onPageChange,
  currentUser
}) => {
  const { format } = useCurrency();
  const salesStages = [
    { n: 1, label: 'Lead', color: 'bg-indigo-500' },
    { n: 2, label: 'Site Visit Required', color: 'bg-indigo-600' },
    { n: 3, label: 'Quoting', color: 'bg-blue-600' },
    { n: 4, label: 'Quote Accepted', color: 'bg-blue-700' }
  ];

  const getIdleDays = (lastActivity: string): number => {
    const past = new Date(lastActivity).getTime();
    const now = new Date('2026-07-02T11:58:23-07:00').getTime();
    return Math.floor(Math.abs(now - past) / (1000 * 60 * 60 * 24));
  };

  const priorityDots = {
    urgent: 'bg-ruby',
    high: 'bg-am',
    normal: 'bg-slate-400',
    low: 'bg-em'
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-disp font-extrabold text-ink tracking-tight">Sales Pipeline</h1>
          <p className="text-xs text-mut mt-1">
            {currentUser?.role === 'owner' ? (
              `Stages 1–4 • Total of ${format(jobs.filter(j => j.current_stage <= 4).reduce((sum, j) => sum + j.value, 0))} in early-stage deals`
            ) : (
              'Stages 1–4 • Early-stage deals'
            )}
          </p>
        </div>
        <button
          onClick={() => onPageChange('create-job')}
          className="px-4 py-2.5 bg-sap text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Enquiry
        </button>
      </div>

      {/* Board Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {salesStages.map((stage) => {
          const stageJobs = jobs.filter(j => j.current_stage === stage.n);

          return (
            <div key={stage.n} className="bg-soft/75 border border-line rounded-2xl flex flex-col min-h-[400px]">
              {/* Column Header */}
              <div className="p-4 border-b border-line bg-paper rounded-t-2xl flex justify-between items-center">
                <div className="flex items-center gap-2 text-xs font-disp font-bold text-ink">
                  <span className={`w-2.5 h-2.5 rounded ${stage.color}`} />
                  {stage.label}
                </div>
                <span className="text-sm font-disp font-extrabold text-ink">{stageJobs.length}</span>
              </div>

              {/* Column Cards */}
              <div className="p-3 flex-grow overflow-y-auto space-y-2">
                {stageJobs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-mut font-medium">
                    No jobs at this stage
                  </div>
                ) : (
                  stageJobs.map((job) => {
                    const idle = getIdleDays(job.last_activity_at);
                    return (
                      <div
                        key={job.id}
                        onClick={() => onJobSelect(job.id)}
                        className="bg-paper border border-line rounded-xl p-3.5 cursor-pointer shadow-sm hover:border-mut hover:shadow-md transition-all group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${priorityDots[job.priority]}`} />
                            <span className="text-[10px] font-disp font-bold text-mut">{job.id}</span>
                          </div>
                          {idle > 4 && (
                            <span className="text-[9px] font-bold text-ruby flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {idle}d idle
                            </span>
                          )}
                        </div>

                        <div className="text-sm font-bold text-ink leading-tight truncate group-hover:text-sap transition-colors">
                          {job.client_name}
                        </div>
                        <div className="text-xs text-mut truncate mt-0.5">
                          {job.job_type}
                        </div>

                        <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-soft">
                          <span className="text-[10px] text-zinc-500 font-semibold uppercase">
                            Sara M.
                          </span>
                          {currentUser?.role === 'owner' && (
                            <span className="text-xs font-disp font-extrabold text-ink leading-none">
                              {format(job.value)}
                            </span>
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
  );
};
