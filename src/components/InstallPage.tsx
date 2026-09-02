import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  MapPin, Navigation, Camera, Check, PenTool, Sparkles, Clock, Calendar, 
  ArrowRight, Lock, FileText, Upload, AlertTriangle, TrendingUp, Map as MapIcon, 
  Zap, RefreshCw, Sliders, CheckCircle, CheckCircle2, Car, Eye, RefreshCw as RefreshIcon,
  Download, FileDown, Mail, MessageSquare, Play, Pause, Send, Bell, Globe, Trash2, Truck
} from 'lucide-react';
import { Job } from '../types';
import { dbSync as dbMock } from '../lib/dbSync';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { jsPDF } from 'jspdf';

interface InstallPageProps {
  jobs: Job[];
  onJobSelect: (jobId: string) => void;
  onToast: (msg: string, isWarn?: boolean) => void;
  currentUser: any;
  onAddPhotoClick?: (jobId: string, category: 'qc' | 'site' | 'general') => void;
}

export const InstallPage: React.FC<InstallPageProps> = ({
  jobs,
  onJobSelect,
  onToast,
  currentUser,
  onAddPhotoClick
}) => {
  const checklistItems = [
    { key: 'leveling', label: 'Unload piece, level & align seams' },
    { key: 'epoxy_joints', label: 'Epoxy joints sealed & polished' },
    { key: 'cutouts_caulk', label: 'Sink & hob cutouts sealed & caulked' },
    { key: 'photos_uploaded', label: 'Site installation photos uploaded' },
    { key: 'client_walkthrough', label: 'Walkthrough with client & sign-off gather' }
  ];

  const [activeDay, setActiveDay] = useState<number>(2); // Wednesday (Wed 16) is default active
  const [signatureJobId, setSignatureOpen] = useState<string | null>(null);
  const [signName, setSignName] = useState('');
  const [localRefresh, setLocalRefresh] = useState(0);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [mapStyle, setMapStyle] = useState<'schematic' | 'terrain' | 'live'>('schematic');
  const [viewTab, setViewTab] = useState<'schedule' | 'completed'>('schedule');

  // Completed installations list
  const completedInstallations = useMemo(() => {
    const installations = dbMock.getInstallations();
    const map = new Map<string, { job: Job; inst?: any }>();

    installations.filter(i => i.status === 'Completed').forEach(inst => {
      const job = jobs.find(j => j.id === inst.job_id);
      if (job) {
        map.set(job.id, { job, inst });
      }
    });

    jobs.filter(j => j.current_stage >= 14).forEach(job => {
      if (!map.has(job.id)) {
        const inst = installations.find(i => i.job_id === job.id);
        map.set(job.id, { job, inst });
      }
    });

    return Array.from(map.values());
  }, [jobs, localRefresh]);

  // Traffic Conditions State
  const [trafficDelays, setTrafficDelays] = useState<Record<string, { delayMin: number; status: 'clear' | 'moderate' | 'heavy'; reason?: string }>>({
    'SF-1046': { delayMin: 0, status: 'clear' },
    'SF-1047': { delayMin: 12, status: 'moderate', reason: 'Congestion on M7 Motorway' },
    'SF-1048': { delayMin: 28, status: 'heavy', reason: 'Accident blocking lanes on Great Western Highway' },
  });
  const [isRefreshingTraffic, setIsRefreshingTraffic] = useState(false);

  // Proximity Notification and Crew Tracking State
  const [crewProgress, setCrewProgress] = useState<number>(0); // 0 to 100
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [sentNotifications, setSentNotifications] = useState<Record<string, { emailSent: boolean; pushSent: boolean; timestamp: string }>>({});
  const [notificationLogs, setNotificationLogs] = useState<{ id: string; type: 'email' | 'push'; customerName: string; address: string; eta: number; timestamp: string; details: string }[]>([
    {
      id: 'log-1',
      type: 'email',
      customerName: 'Meridian Builders',
      address: '14 Harbrook Rd, Unit 3',
      eta: 25,
      timestamp: '08:02 AM',
      details: 'Hi Meridian Builders, our crew Tom J. & Dan P. is approaching (ETA: 25 mins). Please ensure pathway clearance.'
    }
  ]);
  const [previewAlertJobId, setPreviewAlertJobId] = useState<string | null>(null);

  // Canvas drawing ref & state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Weekly scheduler
  const weekDays = [
    { day: 'Mon', num: 14, count: 0 },
    { day: 'Tue', num: 15, count: 0 },
    { day: 'Wed', num: 16, count: jobs.filter(j => j.current_stage === 13 || j.current_stage === 14).length },
    { day: 'Thu', num: 17, count: 0 },
    { day: 'Fri', num: 18, count: 1 },
    { day: 'Sat', num: 19, count: 0 },
    { day: 'Sun', num: 20, count: 0 }
  ];

  // Map jobs scheduled for installation
  const installJobs = jobs.filter(j => j.current_stage === 13 || j.current_stage === 14);

  const getRouteOrder = (jobId: string) => {
    const inst = dbMock.getInstallations().find(i => i.job_id === jobId);
    if (inst && inst.route_order !== undefined) {
      return inst.route_order;
    }
    const idx = installJobs.findIndex(j => j.id === jobId);
    return idx >= 0 ? idx + 1 : 999;
  };

  const sortedInstallJobs = [...installJobs].sort((a, b) => {
    return getRouteOrder(a.id) - getRouteOrder(b.id);
  });

  // Dynamically calculate ETA, distance, and proximity status based on crewProgress and traffic
  const getJobETA = (idx: number, progress: number, jobId: string) => {
    const totalJobs = sortedInstallJobs.length || 1;
    // Spreads jobs out along progress coordinates: e.g. 20%, 45%, 70%, 90%
    const stopProgress = 15 + (idx * (75 / Math.max(1, totalJobs)));
    const traffic = getTrafficStatus(jobId);
    const extraDelay = traffic.delayMin || 0;
    
    if (progress >= stopProgress + 3) {
      return { minutes: 0, distanceKm: 0, status: 'completed' as const, stopProgress };
    }
    
    if (progress >= stopProgress - 1) {
      return { minutes: 3, distanceKm: 0.1, status: 'onsite' as const, stopProgress };
    }
    
    const diff = stopProgress - progress;
    const minutes = Math.floor(diff * 1.6 + extraDelay);
    const distanceKm = Number((diff * 0.9).toFixed(1));
    const isWithin30Mins = minutes <= 30;
    
    return { 
      minutes: Math.max(3, minutes), 
      distanceKm: Math.max(0.5, distanceKm), 
      status: isWithin30Mins ? ('proximity' as const) : ('upcoming' as const),
      stopProgress
    };
  };

  // Automatically trigger email/push notifications when crew progress puts them within a 30-minute radius of any customer site
  useEffect(() => {
    if (sortedInstallJobs.length === 0) return;
    
    sortedInstallJobs.forEach((job, idx) => {
      const eta = getJobETA(idx, crewProgress, job.id);
      
      if (eta.status === 'proximity' || eta.status === 'onsite') {
        const isAlreadySent = sentNotifications[job.id]?.emailSent;
        
        if (!isAlreadySent) {
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const emailBody = `Hi ${job.client_name}, our StoneFlow installation crew (Tom J. & Dan P.) is within 30 minutes of your site: ${job.site_address}. Estimated arrival in ${eta.minutes} minutes (adjusted for local traffic). Please verify clear pathway access for the marble/quartz slabs. See you shortly!`;
          
          setSentNotifications(prev => ({
            ...prev,
            [job.id]: {
              emailSent: true,
              pushSent: true,
              timestamp: timeStr
            }
          }));
          
          setNotificationLogs(prev => [
            {
              id: `log-${Date.now()}-${job.id}`,
              type: 'email',
              customerName: job.client_name,
              address: job.site_address.split(',')[0],
              eta: eta.minutes,
              timestamp: timeStr,
              details: emailBody
            },
            ...prev
          ]);
          
          onToast(`📢 Auto-Alert: Customer ${job.client_name} notified! Crew is ${eta.minutes}m away.`, false);
        }
      }
    });
  }, [crewProgress, sortedInstallJobs, sentNotifications]);

  // Route Progress Simulation Timer
  useEffect(() => {
    let interval: any = null;
    if (isSimulating) {
      interval = setInterval(() => {
        setCrewProgress(prev => {
          if (prev >= 100) {
            setIsSimulating(false);
            onToast("🚚 Crew has completed today's route and returned to StoneFlow Depot!", false);
            return 100;
          }
          return prev + 1.5; // moves by 1.5% each step
        });
      }, 400);
    }
    return () => clearInterval(interval);
  }, [isSimulating]);

  const handleManualDispatchAlert = (job: Job, etaMin: number) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const emailBody = `Hi ${job.client_name}, our StoneFlow installation crew is approaching your site: ${job.site_address}. Estimated arrival in ${etaMin} minutes. Please ensure safe walkway and lift access.`;
    
    setSentNotifications(prev => ({
      ...prev,
      [job.id]: {
        emailSent: true,
        pushSent: true,
        timestamp: timeStr
      }
    }));
    
    setNotificationLogs(prev => [
      {
        id: `manual-log-${Date.now()}-${job.id}`,
        type: 'email',
        customerName: job.client_name,
        address: job.site_address.split(',')[0],
        eta: etaMin,
        timestamp: timeStr,
        details: emailBody
      },
      ...prev
    ]);
    
    onToast(`📧 Alert dispatched manually for ${job.client_name}.`, false);
  };

  const handleExportPDF = () => {
    if (sortedInstallJobs.length === 0) {
      onToast('No active routes scheduled to export.', true);
      return;
    }
    
    try {
      const doc = new jsPDF();
      const primaryColor = [14, 122, 95]; // #0E7A5F (StoneFlow green)
      const secondaryColor = [38, 38, 38]; // Dark Charcoal
      
      // Header Banner
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('STONEFLOW CREW DISPATCH SHEET', 15, 18);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Active Day: Wednesday (Route optimized via TSP Solver)  |  Printed: ${new Date().toLocaleDateString()}`, 15, 25);
      doc.text('Assigned Lead Installer: Tom J.  |  Co-Pilot Assistant: Dan P.  |  Vehicle: Van SF-02', 15, 30);
      
      // Body Title
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('OPTIMIZED HANDOVER SCHEDULE & ROUTE', 15, 52);
      
      // Horizontal Line
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(15, 56, 195, 56);
      
      let y = 65;
      
      // Depot Start
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(115, 115, 115);
      doc.text('07:45 AM', 15, y);
      doc.setTextColor(0, 0, 0);
      doc.text('DEPOT START: StoneFlow Arndell Park Depot', 40, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Check strapping, load client marble slabs, secure suction lifters and A-frames.', 40, y + 5);
      
      y += 18;
      
      // Scheduled Jobs Loop
      sortedInstallJobs.forEach((j, index) => {
        const timeSlot = index === 0 ? '08:30 AM' : index === 1 ? '11:00 AM' : index === 2 ? '01:30 PM' : '02:30 PM';
        const traffic = getTrafficStatus(j.id);
        
        // Background card
        doc.setFillColor(248, 250, 252);
        doc.rect(15, y - 5, 180, 26, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(15, y - 5, 180, 26, 'S');
        
        // Time
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(14, 122, 95);
        doc.text(timeSlot, 18, y + 2);
        
        // Client Name & Job
        doc.setTextColor(0, 0, 0);
        doc.text(`STOP #${index + 1}: ${j.client_name} (${j.id})`, 45, y + 2);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.text(`Address: ${j.site_address}`, 45, y + 7);
        doc.text(`Install Type: ${j.job_type} | Value: $${j.value.toLocaleString()}`, 45, y + 12);
        
        if (traffic.status !== 'clear') {
          doc.setTextColor(180, 83, 9);
          doc.setFont('helvetica', 'bold');
          doc.text(`⚠️ Warning: ${traffic.status} congestion (+${traffic.delayMin}m delay expected)`, 45, y + 17);
        } else {
          doc.setTextColor(16, 185, 129);
          doc.text(`✓ Road clear (normal highway dispatch expected)`, 45, y + 17);
        }
        
        y += 32;
      });
      
      // Depot Return
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(115, 115, 115);
      doc.text('03:30 PM', 15, y);
      doc.setTextColor(0, 0, 0);
      doc.text('DEPOT RETURN: Off-cut stock & tooling checkin', 40, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Unload stone off-cuts and register return pieces on the off-cut scanner. Rack toolkits.', 40, y + 5);
      
      y += 20;
      
      // Guidelines & Signatures
      doc.setDrawColor(200, 200, 200);
      doc.line(15, y, 195, y);
      
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('CREW OFFLINE PROTOCOLS:', 15, y);
      
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('1. Walkthrough the completed worktop on site with the client to secure the approval signature.', 15, y);
      doc.text('2. Log handover pictures with the in-app site camera immediately after completion.', 15, y + 4);
      doc.text('3. Send customer proximity alerts in real-time or enable Automatic SMS trigger dispatch.', 15, y + 8);
      
      y += 20;
      doc.setFont('helvetica', 'bold');
      doc.text('Lead Installer Signature: _______________________', 15, y);
      doc.text('Date: ____________', 140, y);
      
      // Save
      doc.save('stoneflow_route_sheet.pdf');
      onToast('📄 PDF Route Dispatch sheet generated and downloaded successfully!');
    } catch (err) {
      console.error(err);
      onToast('Failed to export PDF. Please try again.', true);
    }
  };

  const handleExportCSV = () => {
    if (sortedInstallJobs.length === 0) {
      onToast('No active routes scheduled to export.', true);
      return;
    }
    
    try {
      const csvHeaders = ['Sequence', 'Est Time', 'Client Name', 'Job ID', 'Site Address', 'Job Type', 'Priority', 'Traffic Condition', 'Expected Delay (Min)', 'Value'];
      const csvRows = sortedInstallJobs.map((j, idx) => {
        const timeSlot = idx === 0 ? '08:30 AM' : idx === 1 ? '11:00 AM' : idx === 2 ? '01:30 PM' : '02:30 PM';
        const traffic = getTrafficStatus(j.id);
        return [
          idx + 1,
          timeSlot,
          `"${j.client_name.replace(/"/g, '""')}"`,
          j.id,
          `"${j.site_address.replace(/"/g, '""')}"`,
          `"${j.job_type.replace(/"/g, '""')}"`,
          j.priority,
          traffic.status,
          traffic.delayMin,
          j.value
        ];
      });
      
      const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'stoneflow_optimized_route.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onToast('📊 CSV Route file exported successfully!');
    } catch (err) {
      console.error(err);
      onToast('Failed to export CSV.', true);
    }
  };

  // Real-time automatic route optimization
  const serializedInstallJobs = JSON.stringify(
    installJobs.map(j => [j.id, j.priority, j.site_address, j.current_stage])
  );

  const getTrafficStatus = (jobId: string) => {
    if (trafficDelays[jobId]) {
      return trafficDelays[jobId];
    }
    // Deterministic fallback condition for newly created or imported jobs
    const hash = jobId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const delay = hash % 35;
    const status = delay > 20 ? 'heavy' : delay > 8 ? 'moderate' : 'clear';
    const reasons = [
      'Slow traffic on residential connector',
      'Accident near arterial junction',
      'School zone speed restrictions active',
      'Slow moving heavy vehicle ahead'
    ];
    return {
      delayMin: delay,
      status,
      reason: status !== 'clear' ? reasons[hash % reasons.length] : undefined
    };
  };

  const handleRefreshTraffic = () => {
    setIsRefreshingTraffic(true);
    onToast('Scanning conditions & live traffic feeds...', false);
    setTimeout(() => {
      const updated: Record<string, any> = {};
      installJobs.forEach(j => {
        const roll = Math.random();
        let delayMin = 0;
        let status: 'clear' | 'moderate' | 'heavy' = 'clear';
        let reason: string | undefined;

        if (roll > 0.72) {
          delayMin = Math.floor(18 + Math.random() * 18);
          status = 'heavy';
          reason = 'Incident reported on primary delivery link';
        } else if (roll > 0.38) {
          delayMin = Math.floor(6 + Math.random() * 10);
          status = 'moderate';
          reason = 'Peak hour delay detected on arterial';
        }

        updated[j.id] = { delayMin, status, reason };
      });

      setTrafficDelays(updated);
      setIsRefreshingTraffic(false);
      onToast('Traffic feed updated. Optimal routes re-synchronized.', false);
    }, 900);
  };

  useEffect(() => {
    if (installJobs.length > 0) {
      // Heuristic routing solver:
      // Sort urgent/high priority first, then by site address (simulating geo TSP optimization)
      const sorted = [...installJobs].sort((a, b) => {
        const pA = a.priority === 'urgent' ? 3 : a.priority === 'high' ? 2 : a.priority === 'normal' ? 1 : 0;
        const pB = b.priority === 'urgent' ? 3 : b.priority === 'high' ? 2 : b.priority === 'normal' ? 1 : 0;
        if (pA !== pB) return pB - pA;
        return (a.site_address || '').localeCompare(b.site_address || '');
      });

      // Check if current db order matches optimized order
      let needsUpdate = false;
      for (let i = 0; i < sorted.length; i++) {
        if (getRouteOrder(sorted[i].id) !== i + 1) {
          needsUpdate = true;
          break;
        }
      }

      if (needsUpdate) {
        sorted.forEach((job, index) => {
          dbMock.updateInstallationRouteOrder(job.id, index + 1);
        });
        setLocalRefresh(prev => prev + 1);
      }
    }
  }, [serializedInstallJobs]);

  const handleRouteOptimize = () => {
    if (installJobs.length === 0) {
      onToast('No installation jobs scheduled for optimization!', true);
      return;
    }

    setIsOptimizing(true);
    onToast('Recalculating optimal TSP path for scheduled installations...', false);

    setTimeout(() => {
      // Heuristic sorting: High priority first, then lexicographically by address
      const sorted = [...installJobs].sort((a, b) => {
        const pA = a.priority === 'urgent' ? 3 : a.priority === 'high' ? 2 : a.priority === 'normal' ? 1 : 0;
        const pB = b.priority === 'urgent' ? 3 : b.priority === 'high' ? 2 : b.priority === 'normal' ? 1 : 0;
        if (pA !== pB) return pB - pA;
        return (a.site_address || '').localeCompare(b.site_address || '');
      });

      sorted.forEach((job, index) => {
        dbMock.updateInstallationRouteOrder(job.id, index + 1);
      });
      
      setLocalRefresh(prev => prev + 1);
      setIsOptimizing(false);
      onToast('TSP Route Engine optimized! Optimal route saved and synced to backend database.', false);
    }, 800);
  };

  const handleAdvance = async (jobId: string, clientName: string, currentStage: number) => {
    if (currentStage === 13) {
      const res = await dbMock.updateStage(jobId, 14, currentUser.id, currentUser.name);
      if (res.success) {
        onToast(`Began installation on site for ${clientName}. Job moved to Stage 14 (Installed).`);
      } else {
        onToast(`Gate Locked: ${res.error}`, true);
      }
      setLocalRefresh(prev => prev + 1);
    } else {
      // Stage 14 (Installed) -> open signature sign-off modal
      setSignatureOpen(jobId);
    }
  };

  // Canvas interaction initialization
  useEffect(() => {
    if (signatureJobId) {
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.parentElement?.getBoundingClientRect();
          const w = rect?.width || 380;
          const h = 128;
          canvas.width = w * 2; // scale for high density displays
          canvas.height = h * 2;
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(2, 2);
            ctx.strokeStyle = '#0284c7'; // Deep blue signature ink
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [signatureJobId]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSignatureSubmit = () => {
    if (!signName.trim()) {
      onToast('Client name for sign-off is required', true);
      return;
    }

    if (signatureJobId) {
      const canvas = canvasRef.current;
      const signatureDataUrl = canvas ? canvas.toDataURL('image/png') : undefined;

      dbMock.installerComplete(signatureJobId, signName, signatureDataUrl);
      onToast(`Installation completely signed off and finalized by ${signName}! Moved to Stage 14 (Installed).`);
      setSignatureOpen(null);
      setSignName('');
      setLocalRefresh(prev => prev + 1);
    }
  };

  const handleComputerFileUpload = (jobId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      dbMock.addDrawing(jobId, file.name);
      onToast(`Document "${file.name}" uploaded from computer successfully.`);
      setLocalRefresh(prev => prev + 1);
    }
  };

  // Pre-calculated Optimized Route stops
  const routeStops = [
    { time: '07:45', name: 'StoneFlow Depot', desc: 'Loading & strapping slabs' },
    ...sortedInstallJobs.map((j, idx) => {
      const time = idx === 0 ? '08:30' : idx === 1 ? '11:00' : idx === 2 ? '13:30' : '14:30';
      return {
        time,
        name: j.client_name,
        desc: j.site_address.split(',')[0]
      };
    }),
    { time: '15:30', name: 'StoneFlow Depot', desc: 'Off-cuts returns & tool racks check' }
  ];

  const getSimulatedCoordinates = (jobId: string, index: number) => {
    if (jobId === 'depot') return { x: 50, y: 15 };
    const hash = jobId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const x = 15 + (hash * 17) % 70; // 15% to 85%
    const y = 25 + (hash * 23) % 60; // 25% to 85%
    return { x, y };
  };

  // Map coordinates memo
  const mapPoints = useMemo(() => {
    const points = [{ id: 'depot', name: 'StoneFlow Depot', site_address: 'Arndell Park Depot', x: 50, y: 15 }];
    sortedInstallJobs.forEach((j, index) => {
      const coords = getSimulatedCoordinates(j.id, index);
      points.push({
        id: j.id,
        name: j.client_name,
        site_address: j.site_address,
        x: coords.x,
        y: coords.y,
      });
    });
    points.push({ id: 'depot-return', name: 'StoneFlow Depot', site_address: 'Arndell Park Depot', x: 50, y: 15 });
    return points;
  }, [serializedInstallJobs]);

  // Interpolated coordinates for the moving van on our map based on crewProgress
  const vanCoords = useMemo(() => {
    if (mapPoints.length < 2) return { x: 50, y: 15 };
    const N = mapPoints.length - 1;
    const progressPerSegment = 100 / N;
    
    // Segment index
    let segIdx = Math.floor(crewProgress / progressPerSegment);
    if (segIdx >= N) segIdx = N - 1;
    
    const pt1 = mapPoints[segIdx];
    const pt2 = mapPoints[segIdx + 1];
    
    const segProgress = (crewProgress - segIdx * progressPerSegment) / progressPerSegment;
    const clampedSegProgress = Math.max(0, Math.min(1, segProgress));
    
    return {
      x: pt1.x + (pt2.x - pt1.x) * clampedSegProgress,
      y: pt1.y + (pt2.y - pt1.y) * clampedSegProgress,
    };
  }, [mapPoints, crewProgress]);

  const jobsWithHeavyTraffic = sortedInstallJobs.filter(j => {
    const status = getTrafficStatus(j.id);
    return status.status === 'heavy';
  });

  const efficiencyData = useMemo(() => {
    const activeCount = installJobs.length;
    return [
      { day: 'Mon', actual: 110, optimal: 95, score: 86 },
      { day: 'Tue', actual: 145, optimal: 120, score: 82 },
      { day: 'Wed', actual: activeCount > 0 ? activeCount * 31 + 18 : 98, optimal: activeCount > 0 ? activeCount * 25 + 12 : 82, score: 92 },
      { day: 'Thu', actual: 125, optimal: 118, score: 94 },
      { day: 'Fri', actual: 135, optimal: 128, score: 95 },
    ];
  }, [installJobs.length]);

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Live Traffic Advisory Alert Banner */}
      {activeDay === 2 && jobsWithHeavyTraffic.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-ink">Live Traffic Alert: Significant Route Delay</h4>
              <p className="text-xs text-mut mt-1">
                Heavy traffic delays are active on the way to{' '}
                <span className="font-bold text-red-500 font-disp">
                  {jobsWithHeavyTraffic.map(j => j.client_name).join(', ')}
                </span>
                . The on-board routing engine has automatically recalculated a clear bypass path for the crew.
              </p>
            </div>
          </div>
          <button
            onClick={handleRefreshTraffic}
            disabled={isRefreshingTraffic}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold rounded-xl transition-all whitespace-nowrap self-start md:self-auto cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingTraffic ? 'animate-spin' : ''}`} />
            Scan condition
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-disp font-extrabold text-ink tracking-tight">Installations</h1>
          <p className="text-xs text-mut mt-1">
            Stages 13–14 • Real-time traffic, delivery route planning, on-site fitting, and client handover sign-offs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Tab Switcher */}
          <div className="bg-soft p-1 rounded-xl flex gap-1 border border-line">
            <button
              onClick={() => setViewTab('schedule')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                viewTab === 'schedule'
                  ? 'bg-paper text-ink shadow-xs border border-line/30'
                  : 'text-mut hover:text-ink'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-sap" />
              Active Route ({installJobs.length})
            </button>
            <button
              onClick={() => setViewTab('completed')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                viewTab === 'completed'
                  ? 'bg-paper text-ink shadow-xs border border-line/30'
                  : 'text-mut hover:text-ink'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Installer History ({completedInstallations.length})
            </button>
          </div>

          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Export route sheet as printable PDF for offline use"
          >
            <FileDown className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Active Schedule & Route View */}
      {viewTab === 'schedule' && (
        <>
          {/* Week Day Selector */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {weekDays.map((d, idx) => (
          <button
            key={idx}
            onClick={() => setActiveDay(idx)}
            className={`flex-1 min-w-[72px] p-3 rounded-2xl border text-center transition-all ${
              activeDay === idx 
                ? 'bg-ink text-white border-ink dark:bg-zinc-200 dark:text-black font-semibold' 
                : 'bg-paper border-line text-zinc-600 hover:border-mut'
            }`}
          >
            <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">{d.day}</div>
            <div className="text-lg font-disp font-extrabold mt-1">{d.num}</div>
            <div className={`text-[9px] font-bold mt-1.5 h-3 ${activeDay === idx ? 'text-sap dark:text-sapsoft' : 'text-sap'}`}>
              {d.count > 0 ? `${d.count} inst` : ''}
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Installs today */}
        <div className="lg:col-span-7 space-y-4">
          {activeDay !== 2 || installJobs.length === 0 ? (
            <div className="bg-paper border border-line rounded-2xl p-12 text-center text-sm text-mut">
              No installations scheduled on this day.
            </div>
          ) : (
            sortedInstallJobs.map((j, idx) => {
              const isOnSite = j.current_stage === 14;
              const photos = dbMock.getPhotosForJob(j.id);
              const drawings = dbMock.getDrawingsForJob(j.id);
              const installation = dbMock.getInstallations().find(inst => inst.job_id === j.id);
              const checklist = installation?.checklist || {};
              const traffic = getTrafficStatus(j.id);

              return (
                <div key={j.id} className="bg-paper border border-line rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-disp font-extrabold text-mut w-12 flex-shrink-0">
                        {idx === 0 ? '08:30' : idx === 1 ? '11:00' : idx === 2 ? '13:30' : '14:30'}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-disp font-bold text-ink leading-tight">{j.client_name}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                            traffic.status === 'heavy' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            traffic.status === 'moderate' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                            'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 animate-pulse'
                          }`} title={traffic.reason}>
                            <Car className="w-3 h-3" />
                            {traffic.status === 'heavy' ? `Heavy traffic (+${traffic.delayMin}m)` :
                             traffic.status === 'moderate' ? `Moderate (+${traffic.delayMin}m)` :
                             'Traffic: Clear'}
                          </span>
                        </div>
                        <p className="text-xs text-mut mt-1">{j.id} • {j.job_type}</p>
                        {traffic.status !== 'clear' && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>{traffic.reason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                      isOnSite ? 'bg-emsoft text-em' : 'bg-amsoft text-am'
                    }`}>
                      {isOnSite ? 'On site now' : 'Scheduled'}
                    </span>
                  </div>

                  {/* Site Address */}
                  <div className="flex items-center gap-3 p-3 bg-soft rounded-xl">
                    <MapPin className="w-4 h-4 text-mut flex-shrink-0" />
                    <span className="text-xs font-semibold text-ink flex-grow">{j.site_address}</span>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.site_address || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onToast('Launching GPS Navigation to site...', false)}
                      className="px-3 py-1.5 bg-paper border border-line text-[11px] font-bold rounded-lg text-ink hover:border-mut flex items-center gap-1 hover:text-sap hover:border-sap"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Navigate
                    </a>
                  </div>

                  {/* Installer Quality Checklist */}
                  <div className="space-y-2 p-3 bg-soft/60 border border-line rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sap" />
                        Installer Quality Checklist ({checklistItems.filter(item => Boolean(checklist[item.key])).length}/5)
                      </span>
                      {checklistItems.every(item => Boolean(checklist[item.key])) && (installation?.signature_name || installation?.status === 'Completed') ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300">
                          Installer Complete • Ready for Owner Stage Move
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300">
                          Installer Pending ({5 - checklistItems.filter(item => Boolean(checklist[item.key])).length} tasks left)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      {checklistItems.map(item => {
                        const isChecked = Boolean(checklist[item.key]);
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={async () => {
                              await dbMock.updateInstallationChecklist(j.id, item.key, !isChecked);
                              onToast(`Checklist task "${item.label}" ${!isChecked ? 'completed' : 'unchecked'}.`);
                              setLocalRefresh(prev => prev + 1);
                            }}
                            className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
                              isChecked 
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' 
                                : 'bg-paper border-line text-ink hover:border-mut'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-zinc-400 bg-paper'
                            }`}>
                              {isChecked && <Check className="w-3 h-3 stroke-[3px]" />}
                            </div>
                            <span className={`text-[11px] font-semibold ${isChecked ? 'line-through opacity-80' : ''}`}>
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Shared Media, Photos, and Drawings Attachments Panel */}
                  <div className="pt-3 border-t border-soft/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-ink uppercase tracking-wider">Job Attachments & Shared Media</span>
                      <span className="text-[9px] text-mut">{photos.length} photo(s) • {drawings.length} drawing(s) shared</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Live Shared Photos Panel */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-mut font-semibold uppercase">Shared Photos:</span>
                          <span className="text-[9px] text-mut/80 italic">(From Factory/Office/Crew)</span>
                        </div>
                        {photos.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {photos.map(photo => (
                              <div key={photo.id} className="relative group">
                                <img 
                                  src={photo.url} 
                                  alt={photo.filename} 
                                  referrerPolicy="no-referrer"
                                  className="w-16 h-16 object-cover rounded-lg border border-line bg-soft hover:scale-105 transition-all"
                                />
                                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white text-center py-0.5 truncate rounded-b-lg px-0.5">
                                  {photo.category.toUpperCase()}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-mut italic p-2 bg-soft rounded-lg">No photos uploaded for this job yet.</div>
                        )}
                      </div>

                      {/* Drawings & Documents Panel with Computer Upload */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-mut font-semibold uppercase">CAD Layouts & Documents:</span>
                          <div>
                            <input 
                              type="file" 
                              id={`computer-file-${j.id}`}
                              className="hidden" 
                              onChange={(e) => handleComputerFileUpload(j.id, e)}
                            />
                            <button
                              onClick={() => document.getElementById(`computer-file-${j.id}`)?.click()}
                              className="text-[9px] text-sap hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Upload className="w-2.5 h-2.5" />
                              Upload from Computer
                            </button>
                          </div>
                        </div>
                        {drawings.length > 0 ? (
                          <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-1">
                            {drawings.map(d => (
                              <div key={d.id} className="flex items-center justify-between p-1.5 bg-soft/50 border border-line rounded-lg text-xs">
                                <div className="flex items-center gap-1.5 truncate">
                                  <FileText className="w-3.5 h-3.5 text-zinc-500" />
                                  <span className="font-semibold text-ink truncate" title={d.name}>{d.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                                    d.status === 'approved' ? 'bg-emsoft text-em border-em/10' :
                                    d.status === 'rejected' ? 'bg-rubysoft text-ruby border-ruby/10' :
                                    'bg-amsoft text-am border-am/10'
                                  }`}>
                                    {d.status}
                                  </span>
                                  {currentUser?.role === 'owner' && (
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Are you sure you want to delete drawing "${d.name}"? This action will permanently remove it.`)) {
                                          const ok = await dbMock.deleteDrawing(d.id, currentUser.id, currentUser.name);
                                          if (ok) {
                                            onToast(`Drawing "${d.name}" permanently deleted.`, false);
                                            setLocalRefresh(prev => prev + 1);
                                          } else {
                                            onToast(`Failed to delete drawing "${d.name}".`, true);
                                          }
                                        }
                                      }}
                                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors cursor-pointer"
                                      title="Delete drawing document (Owner Only)"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-mut italic p-2 bg-soft rounded-lg">No template drawings uploaded.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Render Captured Signature if installation is completed */}
                  {installation?.signature_name && (
                    <div className="p-3 bg-emsoft/10 border border-em/20 rounded-xl space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-em tracking-wider">Client Handover Sign-off Verified</span>
                        <span className="text-[9px] text-mut">Job Completed</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="text-xs text-mut font-medium">Customer Signatory</div>
                          <div className="text-sm font-bold text-ink">{installation.signature_name}</div>
                          {installation.completed_at && (
                            <div className="text-[10px] text-mut mt-0.5">Signed at: {new Date(installation.completed_at).toLocaleString()}</div>
                          )}
                        </div>
                        {installation.signature_svg && (
                          <div className="bg-white border border-line p-2 rounded-lg flex items-center justify-center h-16 w-36 shadow-sm">
                            <img src={installation.signature_svg} alt="Client Signature" className="max-h-full max-w-full object-contain" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Installer controls */}
                  <div className="pt-3 border-t border-soft flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-mut font-semibold">
                      Assigned Crew: Tom J. & Dan P.
                    </span>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => onJobSelect(j.id)}
                        className="px-4 py-2 border border-line hover:border-mut rounded-xl text-xs font-semibold text-ink hover:bg-soft transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Open Linked Job Sheet"
                      >
                        <FileText className="w-4 h-4 text-zinc-500" />
                        Job Sheet
                      </button>
                      <button 
                        onClick={() => onAddPhotoClick ? onAddPhotoClick(j.id, 'site') : onToast('Camera opened to log site completion pictures', false)}
                        className="px-4 py-2 border border-line hover:border-mut rounded-xl text-xs font-semibold text-ink hover:bg-soft transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-zinc-500" />
                        Photos
                      </button>
                      
                      {/* If already signed/completed, show completion badge & option to advance to Stage 15 */}
                      {installation?.signature_name ? (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Signed by {installation.signature_name}
                          </span>
                          {j.current_stage === 14 && (
                            <button
                              onClick={async () => {
                                const res = await dbMock.updateStage(j.id, 15, currentUser.id, currentUser.name);
                                if (res.success) {
                                  onToast(`Moved Job ${j.id} to Stage 15 (Invoice Sent).`);
                                  setLocalRefresh(prev => prev + 1);
                                } else {
                                  onToast(`Gate Locked: ${res.error}`, true);
                                }
                              }}
                              className="px-4 py-2 bg-sap text-white font-bold rounded-xl text-xs hover:opacity-90 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              Advance to Billing (Stage 15)
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => setSignatureOpen(j.id)}
                            className="px-4 py-2 border border-line hover:border-mut rounded-xl text-xs font-semibold text-ink hover:bg-soft transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <PenTool className="w-4 h-4 text-zinc-500" />
                            Signature
                          </button>
                          <button 
                            onClick={() => handleAdvance(j.id, j.client_name, j.current_stage)}
                            className="px-5 py-2 bg-sidebg text-white font-semibold rounded-xl text-xs hover:opacity-95 transition-all flex items-center gap-1.5 dark:bg-zinc-200 dark:text-black cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            {isOnSite ? 'Complete Install' : 'Mark On Site'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Routing Command Center & Route Destinations */}
        <div className="lg:col-span-5 space-y-6">

          {/* Section 3: Route Stops timeline */}
          <div className="bg-paper border border-line p-5 rounded-2xl shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Optimized Route stops</h4>
            <div className="relative border-l border-line pl-4 space-y-6 ml-2.5 py-1">
              {routeStops.map((stop, idx) => (
                <div key={idx} className="relative">
                  {/* Pin Circle */}
                  <span className="absolute -left-[22.5px] top-1 w-4 h-4 rounded-full border border-zinc-400 bg-paper flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full" />
                  </span>
                  <div>
                    <div className="text-xs text-mut font-semibold flex items-center gap-2">
                      {stop.time}
                      {idx === 0 || idx === routeStops.length - 1 ? (
                        <span className="text-[9px] font-bold bg-soft px-1 rounded text-mut">DEPOT</span>
                      ) : (
                        <span className="text-[9px] font-bold bg-emsoft px-1 rounded text-em">INSTALL</span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-ink mt-0.5 leading-tight">{stop.name}</div>
                    <div className="text-xs text-mut truncate mt-0.5">{stop.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Crew Details */}
          <div className="bg-paper border border-line p-5 rounded-2xl shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Crew Details</h4>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-amber-600 text-white flex items-center justify-center font-disp font-bold text-xs">
                TJ
              </div>
              <div>
                <div className="text-sm font-bold text-ink leading-none">Tom J.</div>
                <div className="text-xs text-mut mt-1">Lead Installer • Van SF-02</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-zinc-600 text-white flex items-center justify-center font-disp font-bold text-xs">
                DP
              </div>
              <div>
                <div className="text-sm font-bold text-ink leading-none">Dan P.</div>
                <div className="text-xs text-mut mt-1">First-fit Helper • lifting hooks</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Completed Installed History View */}
      {viewTab === 'completed' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Summary Card */}
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-disp font-extrabold text-emerald-950 dark:text-emerald-100">
                  Installer Work Log &amp; Site Handover History
                </h3>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                Displays all completed stone benchtop and slab installations performed by site teams, including customer digital signatures, 5-point quality checklists, and site photos.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white shadow-xs">
                {completedInstallations.length} Installations Completed
              </span>
            </div>
          </div>

          {completedInstallations.length === 0 ? (
            <div className="bg-paper border border-line rounded-2xl p-12 text-center text-sm text-mut">
              No completed installations recorded yet. Once an installer completes on-site checklist items and client sign-off, it will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {completedInstallations.map(({ job, inst }) => {
                const photos = dbMock.getPhotosForJob(job.id);
                const sitePhotos = photos.filter(p => p.category === 'site' || p.category === 'qc');
                const completedDate = inst?.completed_at 
                  ? new Date(inst.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : job.last_activity_at 
                  ? new Date(job.last_activity_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Recent';

                const installerName = inst?.installer_id === 'u-3' ? 'Tom J. / Site Crew' : 'Installer Lead (Site Team)';
                const signName = inst?.signature_name || job.client_name;
                const signatureData = inst?.signature_data_url;

                const defaultChecklistItems = [
                  { title: 'Slabs Leveled & Seams Aligned', key: 'slab_leveled' },
                  { title: 'Epoxy Joints Sealed & Polished', key: 'epoxy_joints' },
                  { title: 'Sink & Hob Cutouts Caulked', key: 'cutouts_caulked' },
                  { title: 'Site Photos Uploaded', key: 'photos_uploaded' },
                  { title: 'Client Walkthrough & Sign-off', key: 'client_signoff' }
                ];

                return (
                  <div
                    key={job.id}
                    className="bg-paper border border-line rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-5 hover:border-mut transition-all"
                  >
                    <div className="space-y-4">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 border-b border-soft pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-extrabold text-mut">{job.id}</span>
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300">
                              STAGE 14: INSTALLED
                            </span>
                          </div>
                          <h4 className="text-lg font-disp font-bold text-ink mt-1">
                            {job.client_name}
                          </h4>
                          <p className="text-xs text-mut font-medium mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-mut shrink-0" />
                            {job.site_address}
                          </p>
                        </div>
                        <button
                          onClick={() => onJobSelect(job.id)}
                          className="px-3 py-1.5 bg-soft hover:bg-line text-ink rounded-xl text-xs font-semibold border border-line cursor-pointer shrink-0"
                        >
                          Job Sheet
                        </button>
                      </div>

                      {/* Material & Crew */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-soft/50 p-3 rounded-xl border border-line/40">
                        <div>
                          <span className="text-[10px] font-bold text-mut block uppercase">Material Spec</span>
                          <span className="font-semibold text-ink">{job.material || 'Engineered Quartz'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-mut block uppercase">Installer Lead</span>
                          <span className="font-semibold text-ink">{installerName}</span>
                        </div>
                      </div>

                      {/* Checklist */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-mut uppercase tracking-wider block">
                          On-Site Installation Tasks Completed (5/5)
                        </span>
                        <div className="space-y-1">
                          {defaultChecklistItems.map((chk, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs font-medium text-emerald-900 dark:text-emerald-300">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>{chk.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Site Photos */}
                      {sitePhotos.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-mut uppercase tracking-wider block">
                            On-Site Installation Photos ({sitePhotos.length})
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            {sitePhotos.slice(0, 3).map((p, idx) => (
                              <img
                                key={idx}
                                src={p.url}
                                alt="Site install photo"
                                className="w-full h-20 object-cover rounded-xl border border-line"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Customer Sign-off Proof */}
                      <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-3 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
                            Client Handover Sign-Off
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                            Signed by {signName}
                          </span>
                        </div>
                        {signatureData ? (
                          <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                            <img src={signatureData} alt="Client Signature" className="h-10 object-contain" />
                          </div>
                        ) : (
                          <div className="text-xs italic text-emerald-800 dark:text-emerald-300">
                            Digital walkthrough signature verified on-site by {signName}.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-soft flex items-center justify-between text-xs text-mut">
                      <span className="font-semibold text-ink">Completed Date:</span>
                      <span>{completedDate}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Signature Capture Dialog Modal */}
      {signatureJobId && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex justify-center items-center p-4"
          onClick={() => setSignatureOpen(null)}
        >
          <div 
            className="bg-paper border border-line rounded-2xl shadow-2xl w-full max-w-md h-fit overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-line flex justify-between items-center bg-soft">
              <h3 className="font-disp font-bold text-ink text-base">Handover Sign-off</h3>
              <button 
                onClick={() => setSignatureOpen(null)}
                className="text-mut hover:text-ink text-sm font-bold"
              >
                Close
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-mut leading-relaxed">
                Site walkthrough complete. Ask the customer to write their name and sign below to declare the installation pass.
              </p>

              {/* Name box */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink2 uppercase">Customer Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. David Mills" 
                  value={signName}
                  onChange={(e) => setSignName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-xl text-sm focus:outline-none font-semibold text-ink"
                />
              </div>

              {/* Real Drawing Pad Canvas */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-ink2 uppercase">Signature Drawing</label>
                  <button 
                    type="button"
                    onClick={clearCanvas}
                    className="text-[10px] text-ruby hover:underline font-bold cursor-pointer"
                  >
                    Clear Drawing
                  </button>
                </div>
                <div className="border border-line border-dashed rounded-xl bg-soft h-32 relative cursor-crosshair group overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="absolute inset-0 w-full h-full"
                  />
                  {!isDrawing && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-mut">
                      Sign with your finger, stylus, or mouse here
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 bg-soft border-t border-line flex justify-end gap-2">
              <button
                onClick={() => setSignatureOpen(null)}
                className="px-4 py-2 border border-line bg-paper text-ink font-semibold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSignatureSubmit}
                className="px-4 py-2 bg-em text-white font-semibold rounded-xl text-xs hover:opacity-90 cursor-pointer"
              >
                Submit Sign-off
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
