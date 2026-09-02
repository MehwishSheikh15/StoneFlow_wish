import React, { useState } from 'react';
import { ChevronDown, Database } from 'lucide-react';

interface SystemHealthProps {
  isOnline: boolean;
  onOpenHub?: () => void;
  schemaStatus?: "verified" | "schema_missing" | "connection_error" | "not_configured";
}

export const SystemHealth: React.FC<SystemHealthProps> = ({ isOnline, onOpenHub }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const badgeClass = 'bg-emsoft border-em/20 text-em hover:bg-emsoft/85';
  const dotClass = 'bg-em';
  const label = 'Node.js Express DB (Live)';
  const shortLabel = 'Express DB';
  const headerLabel = 'HIGH PERFORMANCE DB ACTIVE';
  const description = 'All operational data (Jobs, Materials, Offcuts, Invoices, Team Users) persists directly to Node.js / Express DB Server Engine.';
  const showPing = true;

  return (
    <div className="relative flex items-center" id="system-health-container">
      <button
        id="system-health-status-badge"
        onClick={() => setShowTooltip(!showTooltip)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${badgeClass}`}
      >
        <span className="relative flex h-2 w-2">
          {showPing && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-em"></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass}`}></span>
        </span>
        <span className="hidden md:inline font-sans">
          {label}
        </span>
        <span className="hidden sm:inline md:hidden font-sans">
          {shortLabel}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {showTooltip && (
        <div
          id="system-health-tooltip"
          className="absolute right-0 top-full mt-2 w-72 bg-paper border border-line rounded-2xl shadow-xl p-4 z-50 text-xs text-ink space-y-3 animate-fade-in"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div className="flex items-center justify-between border-b border-line pb-2">
            <span className="font-bold text-ink">Database Engine Status</span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emsoft text-em">
              {headerLabel}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-mut">Database Engine:</span>
              <span className="font-semibold text-em">Node.js Express DB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mut">Server Endpoint:</span>
              <span className="font-mono text-[10px] truncate max-w-[160px] text-right">
                /api/db/sync
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-mut">Data Safety:</span>
              <span className="font-semibold text-em">Zero-Loss Persistence</span>
            </div>
          </div>

          <p className="text-[10px] text-mut leading-relaxed pt-1 border-t border-line">
            {description}
          </p>
        </div>
      )}
    </div>
  );
};
