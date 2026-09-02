import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Loader2,
  ChevronDown,
  Image as ImageIcon
} from 'lucide-react';

export const GlobalSyncIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [showPopover, setShowPopover] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Read pending uploads from localStorage
  const loadPendingItems = () => {
    try {
      const data = localStorage.getItem('stoneflow_pending_uploads');
      setPendingItems(data ? JSON.parse(data) : []);
    } catch (e) {
      console.error('Failed to read pending uploads', e);
      setPendingItems([]);
    }
  };

  // Setup connection and pending updates listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen to custom event when uploads are modified
    window.addEventListener('stoneflow_pending_uploads_changed', loadPendingItems);
    // Listen to standard storage events (for multi-tab / iframe sync)
    window.addEventListener('storage', loadPendingItems);

    // Initial load
    loadPendingItems();

    // Regular polling fallback to ensure count stays absolute fresh
    const interval = setInterval(loadPendingItems, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('stoneflow_pending_uploads_changed', loadPendingItems);
      window.removeEventListener('storage', loadPendingItems);
      clearInterval(interval);
    };
  }, []);

  // Handle clicking outside to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPopover(false);
      }
    };
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopover]);

  // Synchronize queue with the server
  const handleSyncNow = async () => {
    if (pendingItems.length === 0) return;
    setIsSyncing(true);
    setSyncFeedback('Preparing connection...');

    let successCount = 0;
    let failedCount = 0;
    const remainingPending: any[] = [];

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      setSyncFeedback(`Syncing photo ${i + 1} of ${pendingItems.length}...`);
      
      try {
        const response = await fetch('/api/photos/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: item.jobId,
            category: item.category,
            image: item.image,
            filename: item.filename
          })
        });

        if (response.ok) {
          successCount++;
        } else {
          failedCount++;
          remainingPending.push({
            ...item,
            error: `Server sync rejected (${response.status})`
          });
        }
      } catch (err: any) {
        failedCount++;
        remainingPending.push({
          ...item,
          error: err?.message || 'Server connection failed'
        });
      }
    }

    // Save remainder to cache
    try {
      localStorage.setItem('stoneflow_pending_uploads', JSON.stringify(remainingPending));
      window.dispatchEvent(new Event('stoneflow_pending_uploads_changed'));
      window.dispatchEvent(new Event('stoneflow_db_changed')); // Trigger overall DB update
    } catch (e) {
      console.error('Error saving pending uploads', e);
    }

    setPendingItems(remainingPending);
    setIsSyncing(false);

    if (successCount > 0) {
      setSyncFeedback(`Successfully synchronized ${successCount} cached photo(s) with the server!`);
    } else {
      setSyncFeedback('Sync failed. Connection remains offline or server returned errors.');
    }

    // Clear feedback after a few seconds
    setTimeout(() => {
      setSyncFeedback(null);
    }, 4000);
  };

  // Discard all cached changes
  const handleClearQueue = () => {
    if (window.confirm('Are you sure you want to discard all pending offline-cached photo uploads? This action cannot be undone.')) {
      try {
        localStorage.setItem('stoneflow_pending_uploads', JSON.stringify([]));
        window.dispatchEvent(new Event('stoneflow_pending_uploads_changed'));
        setPendingItems([]);
        setSyncFeedback('Offline queue cleared.');
        setTimeout(() => setSyncFeedback(null), 3000);
      } catch (e) {
        console.error('Failed to clear queue', e);
      }
    }
  };

  return (
    <div className="relative" ref={containerRef} id="global-sync-indicator-wrapper">
      {/* Trigger Button */}
      <button
        onClick={() => setShowPopover(!showPopover)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer relative ${
          pendingItems.length > 0
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/15'
            : isOnline
              ? 'bg-zinc-500/5 border-line text-zinc-600 dark:text-zinc-300 hover:bg-zinc-500/10'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/15'
        }`}
        title="Network & Offline Cache Status"
      >
        <span className="relative flex items-center justify-center">
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          )}
        </span>

        <span className="font-sans">
          {isOnline ? 'Online' : 'Offline'}
        </span>

        {pendingItems.length > 0 && (
          <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[9px] font-extrabold text-white animate-pulse">
            {pendingItems.length}
          </span>
        )}

        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {/* Popover Card */}
      {showPopover && (
        <div
          id="global-sync-popover"
          className="absolute right-0 top-full mt-2 w-80 bg-paper border border-line rounded-2xl shadow-2xl p-4 z-[110] text-xs text-ink space-y-3.5 animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <span className="font-bold text-sm tracking-tight text-ink font-disp">Network & Sync Status</span>
            <div className="flex items-center gap-1.5">
              <span className={`relative flex h-2 w-2`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-em' : 'bg-rose-500'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-em' : 'bg-rose-500'}`}></span>
              </span>
              <span className={`text-[10px] font-extrabold uppercase ${isOnline ? 'text-em' : 'text-rose-500'}`}>
                {isOnline ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Diagnostic section */}
          <div className="space-y-2 bg-soft/50 p-2.5 rounded-xl border border-line/40 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-mut font-medium">Device Connectivity:</span>
              <span className={`font-semibold ${isOnline ? 'text-em' : 'text-rose-500'}`}>
                {isOnline ? 'Active Internet Link' : 'Offline / No Signal'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-mut font-medium">Auto-Sync Status:</span>
              <span className="font-semibold text-ink">
                {isOnline ? 'Ready to broadcast' : 'Awaiting Connection'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-mut font-medium">Cached Offline Updates:</span>
              <span className={`font-mono font-bold ${pendingItems.length > 0 ? 'text-amber-500' : 'text-em'}`}>
                {pendingItems.length} photo(s)
              </span>
            </div>
          </div>

          {/* Interactive Feedback / Notifications */}
          {syncFeedback && (
            <div className="p-2.5 bg-zinc-500/10 border border-line rounded-xl text-[11px] text-ink/90 flex items-center gap-2 animate-fade-in">
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 text-sap animate-spin flex-shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              )}
              <span className="font-medium">{syncFeedback}</span>
            </div>
          )}

          {/* Queue Section */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-mut uppercase tracking-wider">
              {pendingItems.length > 0 ? 'Pending Sync Queue' : 'Queue Synchronization'}
            </h4>

            {pendingItems.length > 0 ? (
              <>
                {/* Scrollable list of pending files */}
                <div className="max-h-32 overflow-y-auto border border-line/60 rounded-xl divide-y divide-line/40">
                  {pendingItems.map((item, index) => (
                    <div key={item.id || index} className="p-2 flex items-center justify-between gap-2 hover:bg-soft/40">
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg flex-shrink-0">
                          <ImageIcon className="w-3 h-3" />
                        </div>
                        <div className="truncate text-left">
                          <p className="font-semibold text-[11px] text-ink truncate">
                            {item.filename || `photo_${index + 1}.jpg`}
                          </p>
                          <p className="text-[9px] text-mut truncate">
                            Job ID: {item.jobId} • {item.category || 'general'}
                          </p>
                        </div>
                      </div>
                      {item.error && (
                        <span 
                          className="text-[9px] text-rose-500 font-medium px-1.5 py-0.5 bg-rose-500/5 rounded-md max-w-[80px] truncate"
                          title={item.error}
                        >
                          {item.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Queue action buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1.5">
                  <button
                    onClick={handleClearQueue}
                    disabled={isSyncing}
                    className="flex items-center justify-center gap-1.5 py-2 border border-line hover:bg-rubysoft hover:border-ruby/20 hover:text-ruby rounded-xl font-bold transition-all text-[11px] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Queue
                  </button>

                  <button
                    onClick={handleSyncNow}
                    disabled={isSyncing || !isOnline}
                    className={`flex items-center justify-center gap-1.5 py-2 bg-sap hover:opacity-90 text-white rounded-xl font-bold transition-all text-[11px] cursor-pointer shadow-sm ${
                      !isOnline ? 'opacity-50 cursor-not-allowed bg-zinc-400' : ''
                    }`}
                  >
                    {isSyncing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Sync Now
                  </button>
                </div>
              </>
            ) : (
              <div className="py-4 text-center border border-dashed border-line/80 rounded-xl space-y-1.5">
                <div className="inline-flex p-2 bg-em/10 text-em rounded-full">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="font-semibold text-ink text-[11px]">All Data Synchronized</p>
                <p className="text-[10px] text-mut max-w-[190px] mx-auto">
                  There are no pending offline photo uploads waiting to sync.
                </p>
              </div>
            )}
          </div>

          {/* Transparent explanatory footnote for field installers */}
          <p className="text-[9px] text-mut leading-relaxed pt-2.5 border-t border-line/60">
            <strong>Installer Transparency:</strong> If internet signal drops during site inspections or templating, StoneFlow automatically caches high-res photos to secure offline local storage. They remain fully preserved here until a stable signal is detected for cloud synchronization.
          </p>
        </div>
      )}
    </div>
  );
};
