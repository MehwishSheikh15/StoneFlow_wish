import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, CheckCircle2, Eye, ShieldAlert, Zap, RefreshCw, Layers, ShieldCheck, Clock, FileWarning } from 'lucide-react';
import { WarningItem, Job, User } from '../types';
import { dbSync as dbMock, PRIORITY_THRESHOLDS, STAGES } from '../lib/dbSync';

interface WarningsPageProps {
  warnings: WarningItem[];
  onJobSelect: (jobId: string) => void;
  onToast: (msg: string, isWarn?: boolean) => void;
  currentUser?: User;
}

export const WarningsPage: React.FC<WarningsPageProps> = ({
  warnings,
  onJobSelect,
  onToast,
  currentUser
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);

  useEffect(() => {
    setActiveJobs(dbMock.getJobs());
  }, [warnings]);

  const handleResolve = (id: string, title: string) => {
    dbMock.resolveWarning(id);
    onToast(`Warning resolved: ${title}`);
  };

  const handleResolveAll = () => {
    dbMock.resolveAllWarnings();
    onToast('All warnings reviewed and archived from active feed.');
  };

  const handleTriggerScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      dbMock.runAutomatedRules();
      setIsScanning(false);
      setActiveJobs(dbMock.getJobs());
      onToast('Automated Warning Engine Scan complete. Active alerts refreshed.');
    }, 600);
  };

  const getIdleDays = (lastActivity: string): number => {
    const past = new Date(lastActivity).getTime();
    const now = new Date('2026-07-02T11:58:23-07:00').getTime();
    return Math.floor(Math.abs(now - past) / (1000 * 60 * 60 * 24));
  };

  // Evaluate Live Rule Violators dynamically
  const rule1Violators = activeJobs.filter(j => j.current_stage >= 8 && j.client_approved_at === null);
  const rule2Violators = activeJobs.filter(j => j.current_stage === 9 && j.client_approved_at === null);
  const rule3Violators = activeJobs.filter(j => {
    if (j.current_stage === 13) {
      const hasQCHistory = dbMock.getHistory(j.id).some(h => h.new_stage === 12);
      return !hasQCHistory;
    }
    return false;
  });
  const rule4Violators = activeJobs.filter(j => {
    if (j.current_stage === 15) {
      const inst = dbMock.getInstallations().find(i => i.job_id === j.id);
      return !inst || inst.status !== 'Completed';
    }
    return false;
  });
  const rule5Violators = activeJobs.filter(j => {
    const idle = getIdleDays(j.last_activity_at);
    const threshold = PRIORITY_THRESHOLDS[j.priority] || 7;
    return idle > threshold;
  });
  const rule6Violators = activeJobs.filter(j => j.id === 'SF-1045' && j.current_stage < 13);

  const rulesList = [
    {
      num: 1,
      title: 'Approval Gate Lockout',
      desc: 'Blocks moving beyond Stage 7 without logged customer approval',
      violators: rule1Violators,
      severity: 'block',
      badge: 'Mandatory Approval'
    },
    {
      num: 2,
      title: 'Cutting Before Approval',
      desc: 'Detects if active cutting is initiated without client layout signature',
      violators: rule2Violators,
      severity: 'block',
      badge: 'Critical Quality Check'
    },
    {
      num: 3,
      title: 'Install Scheduled Before QC',
      desc: 'Ensures Stage 12 Supervisor QC checklist is signed before fitting dispatch',
      violators: rule3Violators,
      severity: 'warn',
      badge: 'Operator Compliance'
    },
    {
      num: 4,
      title: 'Invoicing Before Fitment',
      desc: 'Checks if invoice is raised prior to confirmed physical fitting',
      violators: rule4Violators,
      severity: 'warn',
      badge: 'Billing Sequence'
    },
    {
      num: 5,
      title: 'SLA Stale Job Detection',
      desc: 'Alerts when a contract exceeds priority-based idle thresholds',
      violators: rule5Violators,
      severity: 'warn',
      badge: 'Overdue Stages'
    },
    {
      num: 6,
      title: 'Committed Date Escalation',
      desc: 'Flags high-value jobs with approaching target installs in early stages',
      violators: rule6Violators,
      severity: 'warn',
      badge: 'Escalation Alert'
    }
  ];

  const isSmallDevice = typeof window !== 'undefined' && window.innerWidth < 1024;
  const displayWarnings = warnings.filter(warn => {
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
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in select-none px-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-disp font-extrabold text-ink tracking-tight">Warnings &amp; Rules Engine</h1>
          <p className="text-xs text-mut mt-1">
            Live compliance tracking and SLA threshold evaluation by the StoneFlow automated monitor
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTriggerScan}
            disabled={isScanning}
            className="px-4 py-2 bg-paper border border-line text-ink font-semibold rounded-xl text-xs hover:border-mut transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-sap ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? 'Scanning...' : 'Run Rules Audit'}
          </button>
          {warnings.length > 0 && (
            <button
              onClick={handleResolveAll}
              className="px-4 py-2 bg-soft border border-line text-ink font-semibold rounded-xl text-xs hover:border-mut transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 text-em" />
              Mark All Reviewed
            </button>
          )}
        </div>
      </div>

      {/* Rules Engine Dashboard Bento Grid */}
      <div className="bg-paper border border-line rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-sapsoft rounded-lg text-sap">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink">Compliance Rules Scanner</h2>
            <p className="text-[10px] text-mut">StoneFlow automatic safety filters active across active contracts</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rulesList.map(rule => (
            <div key={rule.num} className="border border-line rounded-xl p-4 bg-soft/20 flex flex-col justify-between space-y-3 hover:border-mut transition-all">
              <div>
                <div className="flex justify-between items-start gap-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                    rule.severity === 'block' ? 'bg-rubysoft text-ruby' : 'bg-amsoft text-am'
                  }`}>
                    {rule.severity.toUpperCase()}
                  </span>
                  <span className="text-[9px] font-semibold text-mut tracking-wider uppercase">{rule.badge}</span>
                </div>
                <h3 className="text-xs font-bold text-ink mt-2">Rule {rule.num}: {rule.title}</h3>
                <p className="text-[11px] text-mut mt-1 leading-relaxed">{rule.desc}</p>
              </div>

              <div className="pt-2 border-t border-line/60">
                {rule.violators.length === 0 ? (
                  <div className="text-[10px] text-em font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> All jobs compliant
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-ruby font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {rule.violators.length} violation{rule.violators.length > 1 ? 's' : ''} detected
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
                      {rule.violators.map(j => (
                        <span
                          key={j.id}
                          onClick={() => onJobSelect(j.id)}
                          className="text-[9px] font-mono font-bold bg-paper border border-line hover:border-sap cursor-pointer px-1.5 py-0.5 rounded text-ink flex items-center gap-1"
                          title={`${j.client_name} - Click to Open`}
                        >
                          {j.id} <Eye className="w-2.5 h-2.5 text-zinc-400" />
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings Feed Stream */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-ink flex items-center gap-2">
          <FileWarning className="w-4 h-4 text-mut" />
          Active Warnings Feed ({displayWarnings.length})
        </h2>

        {displayWarnings.length === 0 ? (
          <div className="bg-paper border border-line rounded-2xl p-12 text-center shadow-sm max-w-lg mx-auto">
            <CheckCircle2 className="w-10 h-10 text-em mx-auto mb-3" />
            <h3 className="font-disp font-bold text-lg text-ink">All warnings clear</h3>
            <p className="text-xs text-mut mt-1.5 leading-relaxed">
              No active alert flags or stale jobs detected. The automated system continuously monitors contracts in the background.
            </p>
          </div>
        ) : (
          displayWarnings.map((warn) => {
            let leftBorder = 'bg-slate-400';
            let iconColor = 'text-slate-500 bg-slatesoft';

            if (warn.severity === 'block') {
              leftBorder = 'bg-ruby';
              iconColor = 'text-ruby bg-rubysoft';
            } else if (warn.severity === 'warn') {
              leftBorder = 'bg-am';
              iconColor = 'text-am bg-amsoft';
            }

            return (
              <div 
                key={warn.id}
                className="bg-paper border border-line rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all hover:shadow-md"
              >
                {/* Left Severity border */}
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${leftBorder}`} />

                <div className="flex items-start gap-4">
                  {/* Icon wrapper */}
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${iconColor}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-sm font-bold text-ink leading-none">{warn.title}</h3>
                      <span 
                        onClick={() => onJobSelect(warn.job_id)}
                        className="text-xs font-disp font-extrabold text-sap hover:opacity-85 cursor-pointer ml-1"
                      >
                        {warn.job_id} ({warn.client_name})
                      </span>
                    </div>
                    <p className="text-xs text-mut mt-2 leading-relaxed">
                      {warn.desc}
                    </p>
                    <span className="text-[10px] text-mut block mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Detected {new Date(warn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Operations */}
                <div className="flex gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onJobSelect(warn.job_id)}
                    className="px-3.5 py-1.5 bg-soft border border-line text-ink font-semibold rounded-lg text-xs hover:border-mut transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-zinc-500" />
                    Open Job
                  </button>
                  <button
                    onClick={() => handleResolve(warn.id, warn.title)}
                    className="px-3.5 py-1.5 bg-sidebg text-white font-semibold rounded-lg text-xs hover:opacity-90 transition-all flex items-center gap-1 cursor-pointer dark:bg-zinc-200 dark:text-black"
                  >
                    <Check className="w-4 h-4 text-em" />
                    Resolve
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
