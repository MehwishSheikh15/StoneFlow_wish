import React, { useState, useRef, useEffect } from 'react';
import { QrCode, Camera, Upload, X, Check, Search, ExternalLink, Printer } from 'lucide-react';
import { dbSync as dbMock, STAGES } from '../lib/dbSync';
import { generateStickerPDF } from '../lib/stickerPdfGenerator';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'scan' | 'show';
  // If show mode, specify the type and code payload:
  targetType?: 'slab' | 'offcut' | 'job';
  targetId?: string;
  payload?: {
    title: string;
    subtitle: string;
    extra?: string;
  };
  onScanResult?: (type: 'slab' | 'offcut' | 'job', id: string) => void;
}

export const QRModal: React.FC<QRModalProps> = ({
  isOpen,
  onClose,
  mode,
  targetType = 'job',
  targetId = '',
  payload,
  onScanResult
}) => {
  const [scanTab, setScanTab] = useState<'camera' | 'upload' | 'simulate'>('camera');
  const [dragOver, setDragOver] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Simulation search state
  const [searchQuery, setSearchQuery] = useState('');
  const [scannedResult, setScannedResult] = useState<any | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Webcam controls
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn("Webcam access failed:", err);
      setCameraError('Webcam not detected or blocked. Try simulation mode to test scanner functionality!');
      setScanTab('simulate');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScannedResult(null);
      setSearchQuery('');
    } else if (mode === 'scan' && scanTab === 'camera') {
      startCamera();
    }
    return () => stopCamera();
  }, [isOpen, scanTab, mode]);

  if (!isOpen) return null;

  // Generate a random-looking but reproducible SVG QR pattern based on text input
  const renderSVGQR = (text: string) => {
    // Generate a pseudo-random grid based on the string hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }

    const size = 15; // 15x15 matrix
    const rects = [];
    
    // Add position detection patterns (QR anchors) at corners
    // Top-Left Anchor
    rects.push(<rect key="tl-bg" x={0} y={0} width={4} height={4} fill="currentColor" />);
    rects.push(<rect key="tl-fg" x={1} y={1} width={2} height={2} fill="var(--paper, #ffffff)" />);
    rects.push(<rect key="tl-dot" x={1.5} y={1.5} width={1} height={1} fill="currentColor" />);

    // Top-Right Anchor
    rects.push(<rect key="tr-bg" x={size - 4} y={0} width={4} height={4} fill="currentColor" />);
    rects.push(<rect key="tr-fg" x={size - 3} y={1} width={2} height={2} fill="var(--paper, #ffffff)" />);
    rects.push(<rect key="tr-dot" x={size - 2.5} y={1.5} width={1} height={1} fill="currentColor" />);

    // Bottom-Left Anchor
    rects.push(<rect key="bl-bg" x={0} y={size - 4} width={4} height={4} fill="currentColor" />);
    rects.push(<rect key="bl-fg" x={1} y={size - 3} width={2} height={2} fill="var(--paper, #ffffff)" />);
    rects.push(<rect key="bl-dot" x={1.5} y={size - 2.5} width={1} height={1} fill="currentColor" />);

    // Random noise for the rest of the body
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        // Skip anchors
        if (x < 4 && y < 4) continue;
        if (x >= size - 4 && y < 4) continue;
        if (x < 4 && y >= size - 4) continue;

        // Deterministic bit generator based on coordinate and text hash
        const val = Math.abs(Math.sin(hash + x * 17 + y * 31));
        if (val > 0.45) {
          rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />);
        }
      }
    }

    return (
      <svg 
        viewBox={`0 0 ${size} ${size}`} 
        className="w-full h-full text-zinc-900 dark:text-zinc-100"
        shapeRendering="crispEdges"
      >
        {rects}
      </svg>
    );
  };

  // Perform fake or real scans
  const handleScanItem = (type: 'slab' | 'offcut' | 'job', id: string, itemData: any) => {
    // Subtle haptic and auditory feedback pulse
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([60, 40, 60]);
      }
    } catch (e) {
      console.warn("Haptic feedback not supported on this device/environment");
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        oscillator.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.12); // E6 note
        
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
      }
    } catch (e) {
      console.warn("Audio feedback context not enabled or supported:", e);
    }

    setScannedResult({
      type,
      id,
      ...itemData
    });

    if (onScanResult) {
      onScanResult(type, id);
    }
  };

  // Generate dynamic scanner targets from active jobs in database
  const jobs = dbMock.getJobs();
  const dynamicJobTargets = jobs.map(j => {
    const stageName = STAGES.find(s => s.n === j.current_stage)?.name || 'Pending';
    return {
      type: 'job' as const,
      id: j.id,
      title: `Job ${j.id} (${j.client_name})`,
      desc: `${j.job_type || 'Custom Work'} • Current Phase: ${stageName}`,
      data: { client: j.client_name, stage: stageName, jobId: j.id }
    };
  });

  const simulateTargets = [
    {
      type: 'slab' as const,
      id: 'SLAB-CALACATTA-2041',
      title: 'Slab #2041 (Calacatta)',
      desc: 'Active kitchen worktop, assigned to Meridian Builders',
      data: { color: 'Calacatta', brand: 'Premium Stone', jobId: 'SF-1042' }
    },
    {
      type: 'offcut' as const,
      id: 'OC-1042-A',
      title: 'Off-cut OC-1042-A',
      desc: 'Nero Marquina remnant from cutting stage, 1500x800mm',
      data: { color: 'Nero Marquina', brand: 'Aria Slabs', size: '1500 x 800 mm', location: 'Rack B-12' }
    },
    ...dynamicJobTargets
  ];

  const handlePrint = () => {
    if (targetId) {
      if (targetType === 'job' || targetId.startsWith('SF-')) {
        dbMock.logActivity(targetId, 'u-1', `Printed physical QR tracking sticker code PDF for Job ${targetId}`);
      } else {
        dbMock.logActivity('SF-1031', 'u-1', `Printed physical QR code label PDF for ${targetType || 'item'} ${targetId}`);
      }
      dbMock.saveAsync().catch(console.warn);
    }
    generateStickerPDF({
      targetId: targetId || 'STONEFLOW-QR',
      title: payload?.title || `Slab/Job Label ${targetId}`,
      subtitle: payload?.subtitle,
      extra: payload?.extra,
      type: (targetType === 'slab' || targetType === 'offcut') ? targetType : 'job'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:bg-white">
      <div className="bg-paper border border-line rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh] print:border-none print:shadow-none print:max-h-full print:w-full">
        {/* Header (Hidden in print) */}
        <div className="p-5 border-b border-line bg-soft flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sap flex items-center justify-center text-white">
              <QrCode className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-disp font-extrabold text-ink text-base">
                {mode === 'scan' ? 'Slab & Job QR Scanner' : 'Slab QR Identifier Label'}
              </h3>
              <p className="text-[10px] text-mut mt-0.5">
                {mode === 'scan' ? 'Scan slab codes to check specifications' : `ID Code: ${targetId}`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-line rounded-lg text-mut hover:text-ink cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* --- SHOW QR CODE LABELS MODE --- */}
        {mode === 'show' && (
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            <div className="border border-line rounded-2xl p-5 bg-paper space-y-4 shadow-sm text-center max-w-[280px] mx-auto print:border-2 print:border-black print:text-black">
              <div className="uppercase tracking-widest text-[9px] font-bold text-sap leading-none">
                STONEFLOW LOGISTICS SYSTEM
              </div>
              <h4 className="font-disp font-extrabold text-lg text-ink leading-tight">
                {payload?.title || 'Slab Label'}
              </h4>
              <div className="w-40 h-40 mx-auto border border-line p-2.5 bg-white rounded-xl flex items-center justify-center shadow-inner">
                {renderSVGQR(targetId || 'STONEFLOW-QR')}
              </div>
              <div className="text-xs font-mono font-bold bg-soft text-ink px-2.5 py-1 rounded inline-block">
                {targetId}
              </div>
              <div className="text-[10px] text-mut leading-relaxed">
                {payload?.subtitle || 'Raw marble slab record.'}
                {payload?.extra && <span className="block font-semibold mt-1 text-ink">{payload.extra}</span>}
              </div>
            </div>

            {/* Print Controls */}
            <div className="flex gap-2 justify-center print:hidden">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-sap text-white font-bold rounded-xl text-xs hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4.5 h-4.5" />
                Print Slab Sticker
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-soft border border-line text-ink font-bold rounded-xl text-xs hover:bg-line cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* --- DISCOVER & SCAN QR CODE MODE --- */}
        {mode === 'scan' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Tab select (Hidden in print) */}
            <div className="border-b border-line grid grid-cols-3 text-center text-xs font-semibold bg-soft/50 print:hidden">
              <button
                onClick={() => { setScanTab('camera'); setScannedResult(null); }}
                className={`py-3 border-b-2 transition-all cursor-pointer ${
                  scanTab === 'camera' ? 'border-sap text-sap bg-paper' : 'border-transparent text-mut hover:text-ink'
                }`}
              >
                Live Camera
              </button>
              <button
                onClick={() => { setScanTab('upload'); setScannedResult(null); stopCamera(); }}
                className={`py-3 border-b-2 transition-all cursor-pointer ${
                  scanTab === 'upload' ? 'border-sap text-sap bg-paper' : 'border-transparent text-mut hover:text-ink'
                }`}
              >
                Upload Image
              </button>
              <button
                onClick={() => { setScanTab('simulate'); setScannedResult(null); stopCamera(); }}
                className={`py-3 border-b-2 transition-all cursor-pointer ${
                  scanTab === 'simulate' ? 'border-sap text-sap bg-paper' : 'border-transparent text-mut hover:text-ink'
                }`}
              >
                Simulate Scan
              </button>
            </div>

            {/* Main content viewport */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              
              {/* Camera view */}
              {scanTab === 'camera' && !scannedResult && (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-square flex flex-col items-center justify-center border border-line">
                  {cameraActive ? (
                    <>
                      <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                      {/* Scanning visual overlay */}
                      <div className="absolute inset-8 border-2 border-emerald-500 rounded-xl pointer-events-none animate-pulse">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-500 -mt-1 -ml-1" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-500 -mt-1 -mr-1" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-500 -mb-1 -ml-1" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-500 -mb-1 -mr-1" />
                        
                        {/* Laser line effect */}
                        <div className="absolute left-0 right-0 h-0.5 bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)] top-1/2 -translate-y-1/2 animate-bounce" />
                      </div>
                      <div className="absolute bottom-3 bg-black/60 backdrop-blur-sm text-[10px] text-white px-3 py-1 rounded-full font-semibold">
                        Align industrial slab QR sticker inside frame
                      </div>
                    </>
                  ) : (
                    <div className="p-6 text-center space-y-2 text-zinc-400">
                      <Camera className="w-8 h-8 text-mut mx-auto animate-pulse" />
                      <p className="text-xs">Accessing video device stream...</p>
                    </div>
                  )}
                </div>
              )}

              {/* Upload image view */}
              {scanTab === 'upload' && !scannedResult && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    // Just decode dummy match for easy workable experience
                    handleScanItem('slab', 'SLAB-CALACATTA-2041', simulateTargets[0].data);
                  }}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all flex flex-col items-center justify-center gap-3 cursor-pointer ${
                    dragOver ? 'border-sap bg-sap/5' : 'border-line hover:border-mut bg-soft/30'
                  }`}
                  onClick={() => {
                    // Simulate image uploaded and parsed instantly
                    handleScanItem('slab', 'SLAB-CALACATTA-2041', simulateTargets[0].data);
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-soft border border-line flex items-center justify-center text-mut shadow-sm">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-ink block">Upload or drop QR sticker image</span>
                    <span className="text-[10px] text-mut mt-1 block">automatically identifies the slab code</span>
                  </div>
                </div>
              )}

              {/* Simulation view */}
              {scanTab === 'simulate' && !scannedResult && (
                <div className="space-y-3">
                  <p className="text-xs text-mut leading-relaxed">
                    Select a QR barcode target from the warehouse registry below to trigger a mock physical barcode scan:
                  </p>
                  <div className="space-y-2">
                    {simulateTargets.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleScanItem(item.type, item.id, item.data)}
                        className="w-full text-left p-3.5 border border-line rounded-xl hover:border-sap hover:bg-sap/5 bg-paper transition-all flex items-start gap-3 cursor-pointer"
                      >
                        <div className="p-2 bg-soft rounded-lg text-ink">
                          <QrCode className="w-4 h-4 text-sap" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-ink">{item.title}</div>
                          <p className="text-[10px] text-mut mt-0.5 leading-normal">{item.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scanned result card */}
              {scannedResult && (
                <div className="border border-line rounded-2xl bg-paper p-5 space-y-4 shadow-sm animate-scale-in">
                  <div className="flex items-center gap-2 text-em">
                    <div className="w-6 h-6 rounded-full bg-emsoft flex items-center justify-center text-em">
                      <Check className="w-4 h-4 stroke-[3px]" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">QR Code Verified</span>
                  </div>

                  <div className="pt-2 border-t border-soft space-y-2">
                    <div className="text-xs text-mut font-semibold uppercase tracking-wider">
                      Identified Registry
                    </div>
                    <div>
                      <h4 className="font-disp font-extrabold text-ink text-base">
                        {scannedResult.id}
                      </h4>
                      <span className="text-[10px] font-mono bg-soft border border-line text-mut px-2 py-0.5 rounded uppercase mt-1 inline-block">
                        {scannedResult.type} tag
                      </span>
                    </div>

                    {/* Metadata breakdown */}
                    <div className="p-3 bg-soft rounded-xl space-y-1.5 mt-3">
                      {scannedResult.type === 'slab' && (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-mut font-medium">Stone Color:</span>
                            <span className="font-bold text-ink">{scannedResult.color}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-mut font-medium">Linked Job Ref:</span>
                            <span className="font-bold text-sap flex items-center gap-1">
                              {scannedResult.jobId}
                              <ExternalLink className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </>
                      )}
                      {scannedResult.type === 'offcut' && (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-mut font-medium">Remnant Dimension:</span>
                            <span className="font-bold text-ink">{scannedResult.size}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-mut font-medium">Rack Location:</span>
                            <span className="font-bold text-ink">{scannedResult.location}</span>
                          </div>
                        </>
                      )}
                      {scannedResult.type === 'job' && (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-mut font-medium">Client Developer:</span>
                            <span className="font-bold text-ink">{scannedResult.client}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-mut font-medium">Stage Phase:</span>
                            <span className="font-bold text-ink">{scannedResult.stage}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        // Open the linked job detail page!
                        if (scannedResult.jobId) {
                          onScanResult?.('job', scannedResult.jobId);
                        } else if (scannedResult.type === 'job') {
                          onScanResult?.('job', scannedResult.id);
                        } else {
                          onClose();
                        }
                      }}
                      className="flex-1 py-2 bg-sap hover:opacity-90 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Open Linked Job File
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setScannedResult(null)}
                      className="px-4 py-2 bg-soft border border-line text-ink font-bold rounded-xl text-xs hover:bg-line cursor-pointer"
                    >
                      Scan Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
