import React from 'react';
import { PenSquare, Lock, Unlock, ArrowRight, FileText, CheckCircle2 } from 'lucide-react';
import { Job } from '../types';
import { dbSync as dbMock, STAGES } from '../lib/dbSync';

interface DesignApprovalProps {
  jobs: Job[];
  onJobSelect: (jobId: string) => void;
  onToast: (msg: string, isWarn?: boolean) => void;
  currentUser: any;
}

export const DesignApproval: React.FC<DesignApprovalProps> = ({
  jobs,
  onJobSelect,
  onToast,
  currentUser
}) => {
  // Filter jobs in Phase 2 (Stages 5-7)
  const designJobs = jobs.filter(j => j.current_stage >= 5 && j.current_stage <= 7);

  const handleApprove = (jobId: string, clientName: string) => {
    dbMock.logClientApproval(jobId, currentUser.id, currentUser.name);
    onToast(`Client approval logged for ${clientName} — Gate unlocked for Production (8–12)`);
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-disp font-extrabold text-ink tracking-tight">Design & Approval</h1>
        <p className="text-xs text-mut mt-1">
          Stages 5–7 • Measuring, CAD drawings, and customer sign-offs. The Approval Gate resides here.
        </p>
      </div>

      {/* Info Warning Alert regarding Gate */}
      <div className="p-4 bg-amber-600/10 border border-amber-500/20 rounded-2xl flex items-start gap-4">
        <div className="p-2 bg-amsoft text-am rounded-xl flex-shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-ink leading-tight">Critical Gate — Stage 7</h4>
          <p className="text-xs text-mut mt-1 leading-relaxed">
            A job must **NEVER** move into Production (Stages 8–12) without a recorded client approval timestamp (`client_approved_at`). 
            The system enforces this gate restriction in the transition layer. 
          </p>
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="space-y-4">
        {designJobs.length === 0 ? (
          <div className="bg-paper border border-line rounded-2xl p-12 text-center text-sm text-mut">
            No jobs currently in the Design and Approval phase.
          </div>
        ) : (
          designJobs.map((job) => {
            const isApproved = job.client_approved_at !== null;
            const stageName = STAGES.find(s => s.n === job.current_stage)?.name || '';

            return (
              <div 
                key={job.id} 
                className="bg-paper border border-line rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-mut transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Job and Phase Info */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-mut tracking-tight">{job.id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        job.priority === 'urgent' ? 'bg-rubysoft text-ruby' : 'bg-slatesoft text-slate'
                      }`}>
                        {job.priority.toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-lg font-disp font-bold text-ink mt-2 leading-none">
                      {job.client_name}
                    </h3>
                    <p className="text-xs text-mut mt-1.5 font-medium">
                      {job.job_type} • {stageName}
                    </p>
                  </div>

                  {/* Actions / Gate state widget */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Active Gate status indicator badge */}
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                      isApproved 
                        ? 'bg-emsoft text-em border-em/10' 
                        : 'bg-rubysoft text-ruby border-ruby/10'
                    }`}>
                      {isApproved ? <Unlock className="w-4 h-4 text-em" /> : <Lock className="w-4 h-4 text-ruby" />}
                      {isApproved ? 'Gate Unlocked' : 'Awaiting Approval'}
                    </span>

                    {/* Quick Approve Action */}
                    {!isApproved && job.current_stage >= 6 && (
                      <button
                        onClick={() => handleApprove(job.id, job.client_name)}
                        className="px-4 py-2 bg-em text-white font-semibold rounded-xl text-xs hover:opacity-90 transition-all shadow-sm"
                      >
                        Log Client Approval
                      </button>
                    )}

                    <button
                      onClick={() => onJobSelect(job.id)}
                      className="px-4 py-2 bg-soft text-ink font-semibold rounded-xl text-xs hover:bg-line transition-all border border-line flex items-center gap-1.5"
                    >
                      Open Detail
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sub-view detailing Drawings Status */}
                <div className="mt-5 pt-4 border-t border-soft grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-soft/50 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-paper border border-line flex items-center justify-center text-zinc-500">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-mut">Measurement Sheet</span>
                      <p className="text-xs text-ink font-semibold mt-0.5">
                        {job.current_stage >= 5 ? '✓ Site measured & sheet uploaded' : 'Pending measurement'}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-soft/50 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-paper border border-line flex items-center justify-center text-zinc-500">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-mut">Drawing CAD Revision</span>
                      <p className="text-xs text-ink font-semibold mt-0.5">
                        {job.current_stage >= 6 ? '✓ Rev C drawing complete' : 'In drawing queue'}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-soft/50 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-paper border border-line flex items-center justify-center text-zinc-500">
                      <CheckCircle2 className={`w-4.5 h-4.5 ${isApproved ? 'text-em' : 'text-mut'}`} />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-mut">Client Acceptance</span>
                      <p className="text-xs text-ink font-semibold mt-0.5">
                        {isApproved ? '✓ Approval timestamp logged' : 'Awaiting digital sign-off'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
