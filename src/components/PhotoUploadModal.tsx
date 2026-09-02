import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Check, Image as ImageIcon, Sparkles, AlertTriangle, Wifi, RefreshCw } from 'lucide-react';
import { dbSync as dbMock } from '../lib/dbSync';
import { JobPhoto } from '../types';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  category: 'qc' | 'site' | 'general';
  onUploadSuccess?: (photo: JobPhoto) => void;
}

// Preset dynamic textures/sceneries for quick mock simulations
const GALLERY_PRESETS = [
  {
    name: 'Calacatta Gold Premium',
    desc: 'High-end Italian marble vein texture',
    gradient: 'linear-gradient(135deg, #fafaf8 0%, #f3f1ec 45%, #d5c399 47%, #bda474 48%, #f3f1ec 50%, #e8e6e0 100%)',
    veins: '#d5c399'
  },
  {
    name: 'Nero Marquina Black',
    desc: 'Deep black with sharp white recrystallization veins',
    gradient: 'linear-gradient(125deg, #111215 0%, #1a1c23 48%, #ffffff 49%, #ffffff 51%, #1a1c23 52%, #090a0c 100%)',
    veins: '#ffffff'
  },
  {
    name: 'Verde Alpi Green',
    desc: 'Rich forest green marble with emerald streaks',
    gradient: 'linear-gradient(140deg, #0e271c 0%, #173f2e 40%, #b2dbcc 41%, #173f2e 43%, #081711 100%)',
    veins: '#b2dbcc'
  },
  {
    name: 'Bridge Saw Cutting Phase',
    desc: 'Slab layout aligned under water-cooled bridge saw',
    gradient: 'linear-gradient(150deg, #343a40 0%, #495057 30%, #228be6 31%, #1c7ed6 33%, #495057 35%, #212529 100%)',
    veins: '#228be6'
  },
  {
    name: 'Completed Kitchen Install',
    desc: 'Bullnose edge profiles fitted perfectly with undermount sink',
    gradient: 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 50%, #ced4da 100%)',
    veins: '#495057'
  }
];

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  jobId,
  category,
  onUploadSuccess
}) => {
  const [uploadMode, setUploadMode] = useState<'file' | 'camera' | 'presets'>('file');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState('');
  
  // Upload status and fallback feedback
  const [uploadError, setUploadError] = useState<{ message: string; networkStatus?: number; source?: string } | null>(null);

  // Pending Uploads state and queue helpers
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);

  const getPendingUploads = () => {
    try {
      const data = localStorage.getItem('stoneflow_pending_uploads');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to parse pending uploads from localStorage", e);
      return [];
    }
  };

  const savePendingUploads = (uploads: any[]) => {
    try {
      localStorage.setItem('stoneflow_pending_uploads', JSON.stringify(uploads));
      window.dispatchEvent(new Event('stoneflow_pending_uploads_changed'));
    } catch (e) {
      console.error("Failed to save pending uploads to localStorage", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPendingList(getPendingUploads());
      setRetryFeedback(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOnline = () => {
      const pending = getPendingUploads();
      if (pending.length > 0) {
        setRetryFeedback("Internet connection re-established! Click 'Sync with Server' to synchronize cached items with the server.");
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleRetryPending = async () => {
    const pending = getPendingUploads();
    if (pending.length === 0) return;

    setIsRetrying(true);
    setRetryFeedback("Synchronizing pending uploads with server...");

    let successCount = 0;
    let failedCount = 0;
    const remainingPending: any[] = [];

    for (const item of pending) {
      try {
        const response = await fetch("/api/photos/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
            error: `Server rejected with status ${response.status}`
          });
        }
      } catch (err: any) {
        failedCount++;
        remainingPending.push({
          ...item,
          error: err?.message || 'Network connection failed'
        });
      }
    }

    savePendingUploads(remainingPending);
    setPendingList(remainingPending);
    setIsRetrying(false);

    if (successCount > 0) {
      setRetryFeedback(`Successfully uploaded ${successCount} cached photo(s) to server!${failedCount > 0 ? ` ${failedCount} item(s) remain cached.` : ''}`);
    } else {
      setRetryFeedback(`Retry failed. Connection remains offline or server returned errors.`);
    }
  };

  const clearPendingUploads = () => {
    savePendingUploads([]);
    setPendingList([]);
    setRetryFeedback("Cleared all pending uploads.");
  };
  
  // Webcam elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Camera Management
  const startCamera = async () => {
    setCameraError(null);
    setPreviewUrl(null);
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
      setCameraError(err.message || 'Could not access device camera. Please check permissions or upload a file.');
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
      setPreviewUrl(null);
      setSelectedPresetIdx(null);
      setCustomFileName('');
      setUploadError(null);
    } else {
      setCustomFileName(`${category.toUpperCase()}-JOB-${jobId}-${Date.now().toString().substring(10)}.jpg`);
    }
    return () => stopCamera();
  }, [isOpen, uploadMode, jobId, category]);

  if (!isOpen) return null;

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // If video metadata is not loaded yet or is zero, default to 640x480
      const width = video.videoWidth > 0 ? video.videoWidth : 640;
      const height = video.videoHeight > 0 ? video.videoHeight : 480;
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Pre-fill with a professional slate/grey background instead of default transparent/black
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Only draw the video frame if video has loaded data
        try {
          if (video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } else {
            // Draw a placeholder graphic so it never shows up as just a black block
            ctx.fillStyle = '#334155';
            ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('CAMERA STREAM INITIALIZING', canvas.width / 2, canvas.height / 2 - 10);
            ctx.font = '10px sans-serif';
            ctx.fillText('Please wait 1-2 seconds and try capturing again.', canvas.width / 2, canvas.height / 2 + 15);
          }
        } catch (e) {
          console.warn("Could not draw video frame to canvas:", e);
        }
        
        // Reset alignment for watermark
        ctx.textAlign = 'left';
        
        // Add a clean timestamp & GPS watermark to simulate professional site logs
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(15, canvas.height - 45, canvas.width - 30, 35);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(
          `STONEFLOW GPS-LOG // JOB: ${jobId} // ${new Date().toLocaleString()} // USER VERIFIED`, 
          25, 
          canvas.height - 24
        );

        const dataUrl = canvas.toDataURL('image/jpeg');
        setPreviewUrl(dataUrl);
        stopCamera();
      }
    }
  };

  // Preset generator (draws a stylized slate/marble preview to canvas to turn into a JPEG)
  const applyPresetImage = (presetIdx: number) => {
    const preset = GALLERY_PRESETS[presetIdx];
    setSelectedPresetIdx(presetIdx);

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw marble background
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      if (presetIdx === 0) { // Calacatta
        grad.addColorStop(0, '#fafaf8');
        grad.addColorStop(0.5, '#f3f1ec');
        grad.addColorStop(0.52, '#d5c399');
        grad.addColorStop(0.54, '#bda474');
        grad.addColorStop(1, '#e8e6e0');
      } else if (presetIdx === 1) { // Nero
        grad.addColorStop(0, '#111215');
        grad.addColorStop(0.5, '#1a1c23');
        grad.addColorStop(0.51, '#ffffff');
        grad.addColorStop(0.53, '#1a1c23');
        grad.addColorStop(1, '#090a0c');
      } else if (presetIdx === 2) { // Verde
        grad.addColorStop(0, '#0e271c');
        grad.addColorStop(0.4, '#173f2e');
        grad.addColorStop(0.41, '#b2dbcc');
        grad.addColorStop(0.43, '#173f2e');
        grad.addColorStop(1, '#081711');
      } else if (presetIdx === 3) { // Cutting
        grad.addColorStop(0, '#2d3748');
        grad.addColorStop(0.3, '#4a5568');
        grad.addColorStop(0.31, '#3182ce');
        grad.addColorStop(0.33, '#4a5568');
        grad.addColorStop(1, '#1a202c');
      } else { // Install
        grad.addColorStop(0, '#edf2f7');
        grad.addColorStop(0.5, '#cbd5e0');
        grad.addColorStop(1, '#a0aec0');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw some elegant random vein details
      ctx.strokeStyle = preset.veins;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(100, 50);
      ctx.bezierCurveTo(250, 200, 300, 100, 600, 550);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(700, 100);
      ctx.bezierCurveTo(550, 300, 450, 400, 200, 580);
      ctx.stroke();

      // StoneFlow HUD stamp
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(30, canvas.height - 65, canvas.width - 60, 45);
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`[STONEFLOW DIGITAL QC EVIDENCE]`, 45, canvas.height - 46);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText(`JOB: ${jobId} // CLASSIFICATION: ${category.toUpperCase()} // ATTACHMENT: ${preset.name}`, 45, canvas.height - 30);

      const dataUrl = canvas.toDataURL('image/jpeg');
      setPreviewUrl(dataUrl);
    }
  };

  // Handle uploaded local file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      console.warn("Uploaded file is not an image type:", file.type);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const base64Data = event.target.result as string;

        // Perform image compression and encoding verification.
        // We load the file as an Image element, wait for its onload event,
        // pre-fill a canvas with white (to avoid black blocks with transparent PNGs),
        // and export to high-quality image/jpeg with 0.85 compression.
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_DIM = 1200;
            let width = img.naturalWidth || img.width || 0;
            let height = img.naturalHeight || img.height || 0;

            if (width <= 0 || height <= 0) {
              console.warn("[PhotoUpload] Loaded image dimensions are invalid:", width, height, "falling back to original.");
              setPreviewUrl(base64Data);
              setCustomFileName(file.name);
              return;
            }

            if (width > MAX_DIM || height > MAX_DIM) {
              if (width > height) {
                height = Math.round((height * MAX_DIM) / width) || 600;
                width = MAX_DIM;
              } else {
                width = Math.round((width * MAX_DIM) / height) || 800;
                height = MAX_DIM;
              }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Pre-fill white background to prevent transparent PNGs from rendering black
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);

              // Draw image safely now that img.onload has completed
              ctx.drawImage(img, 0, 0, width, height);

              // Export as compressed jpeg and verify MIME type and encoding format
              const mimeType = 'image/jpeg';
              const compressedDataUrl = canvas.toDataURL(mimeType, 0.85);

              // If canvas compression is unsupported or returns a broken payload, fall back safely
              if (!compressedDataUrl || compressedDataUrl === 'data:,' || compressedDataUrl.length < 100) {
                console.warn("[PhotoUpload] Canvas compression returned invalid result, falling back to original.");
                setPreviewUrl(base64Data);
                setCustomFileName(file.name);
              } else {
                setPreviewUrl(compressedDataUrl);
                setCustomFileName(file.name.replace(/\.[^/.]+$/, "") + ".jpg");
              }
            } else {
              setPreviewUrl(base64Data);
              setCustomFileName(file.name);
            }
          } catch (err) {
            console.error("Error compressing uploaded image:", err);
            setPreviewUrl(base64Data);
            setCustomFileName(file.name);
          }
        };

        img.onerror = (e) => {
          console.error("Failed to render file into image object:", e);
          setPreviewUrl(base64Data);
          setCustomFileName(file.name);
        };

        img.src = base64Data;
      }
    };
    reader.onerror = (err) => {
      console.error("FileReader failed to process uploaded file:", err);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  // Submission handler
  const handleSave = async () => {
    if (!previewUrl) return;
    setIsUploading(true);
    setUploadError(null);

    const generatedPhotoId = `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let finalPreviewUrl = previewUrl;

    try {
      // Validate MIME type and encoding format of the image data
      if (finalPreviewUrl.startsWith('data:')) {
        const mimeMatch = finalPreviewUrl.match(/^data:([^;]+);base64,/);
        if (!mimeMatch) {
          console.warn("[PhotoUpload] Detected malformed base64 prefix, repairing...");
          if (finalPreviewUrl.includes(';base64,')) {
            const parts = finalPreviewUrl.split(';base64,');
            finalPreviewUrl = `data:image/jpeg;base64,${parts[1]}`;
          } else {
            finalPreviewUrl = `data:image/jpeg;base64,${finalPreviewUrl}`;
          }
        } else {
          const mimeType = mimeMatch[1];
          if (!mimeType.startsWith('image/')) {
            console.error("[PhotoUpload] Invalid non-image MIME type detected:", mimeType);
            setUploadError({ message: `Invalid MIME type: ${mimeType}. Only image files are allowed.` });
            setIsUploading(false);
            return;
          }
        }
      } else if (finalPreviewUrl.startsWith('blob:')) {
        // Blob URLs are local to the current browser session. To ensure persistent display
        // across multi-user environments, we resolve the blob data and encode it as a persistent Base64 string.
        try {
          const response = await fetch(finalPreviewUrl);
          const blob = await response.blob();
          
          if (!blob.type.startsWith('image/')) {
            console.error("[PhotoUpload] Resolved blob has non-image MIME type:", blob.type);
            setUploadError({ message: `Invalid blob MIME type: ${blob.type}. Only image files are allowed.` });
            setIsUploading(false);
            return;
          }
          
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          finalPreviewUrl = base64;
        } catch (err) {
          console.error("[PhotoUpload] Failed to convert Blob URL to Base64:", err);
        }
      } else {
        // Check if raw base64 data was supplied
        const isBase64 = /^[A-Za-z0-9+/=]+$/.test(finalPreviewUrl.replace(/[\s\r\n]+/g, ''));
        if (isBase64) {
          finalPreviewUrl = `data:image/jpeg;base64,${finalPreviewUrl.replace(/[\s\r\n]+/g, '')}`;
        } else if (!finalPreviewUrl.startsWith('http://') && !finalPreviewUrl.startsWith('https://')) {
          console.error("[PhotoUpload] Invalid image data format:", finalPreviewUrl.substring(0, 100));
          setUploadError({ message: "Invalid image encoding format. Must be a valid Base64 Data URL, Blob, or HTTP URL." });
          setIsUploading(false);
          return;
        }
      }

      const res = await dbMock.addPhotoForJob(jobId, category, finalPreviewUrl, customFileName);
      
      if (res.success) {
        if (onUploadSuccess) {
          onUploadSuccess(res.photo);
        }
        onClose();
      } else {
        // Server upload offline/failed, fallback to Local Storage is active
        console.warn(`[Upload UI] Server-side upload failed. Fallback to local storage is active. Error detail: ${res.error}`);
        
        // Serialized representation with a retry_pending flag
        const pendingItem = {
          id: res.photo.id || generatedPhotoId,
          jobId,
          category,
          image: finalPreviewUrl,
          filename: customFileName,
          uploaded_at: res.photo.uploaded_at || new Date().toISOString(),
          retry_pending: true,
          error: res.error || 'Server upload failed.'
        };

        const currentPending = getPendingUploads();
        if (!currentPending.some((u: any) => u.id === pendingItem.id)) {
          currentPending.push(pendingItem);
          savePendingUploads(currentPending);
          setPendingList(currentPending);
        }

        setUploadError({
          message: `${res.error || 'Server upload failed.'} Cached offline with a retry_pending flag.`,
          networkStatus: res.networkStatus,
          source: res.source
        });

        // Propagate the offline-saved photo to the parent component instantly so user has no data loss
        if (onUploadSuccess) {
          onUploadSuccess(res.photo);
        }
      }
    } catch (err: any) {
      console.error("[Upload UI] Unexpected exception during photo save/upload:", err);
      
      const offlinePhoto = {
        id: generatedPhotoId,
        job_id: jobId,
        category,
        url: previewUrl,
        filename: customFileName,
        uploaded_at: new Date().toISOString()
      };

      const pendingItem = {
        id: generatedPhotoId,
        jobId,
        category,
        image: previewUrl,
        filename: customFileName,
        uploaded_at: offlinePhoto.uploaded_at,
        retry_pending: true,
        error: err?.message || 'Unexpected exception'
      };

      const currentPending = getPendingUploads();
      currentPending.push(pendingItem);
      savePendingUploads(currentPending);
      setPendingList(currentPending);

      setUploadError({
        message: `${err?.message || 'Unexpected upload exception.'} Stored in offline cache with retry_pending flag.`
      });

      if (onUploadSuccess) {
        onUploadSuccess(offlinePhoto);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-paper border border-line rounded-3xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-line bg-soft flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sap flex items-center justify-center text-white">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-disp font-extrabold text-ink text-base">Add {category.toUpperCase()} Photo</h3>
              <p className="text-[10px] text-mut mt-0.5">Attach to Job Ref: {jobId}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-line rounded-lg text-mut hover:text-ink cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="border-b border-line grid grid-cols-3 text-center text-[10px] xs:text-xs font-semibold bg-soft/50">
          <button
            onClick={() => { setUploadMode('file'); stopCamera(); }}
            className={`py-3 border-b-2 transition-all cursor-pointer ${
              uploadMode === 'file' ? 'border-sap text-sap bg-paper' : 'border-transparent text-mut hover:text-ink'
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => { setUploadMode('camera'); startCamera(); }}
            className={`py-3 border-b-2 transition-all cursor-pointer ${
              uploadMode === 'camera' ? 'border-sap text-sap bg-paper' : 'border-transparent text-mut hover:text-ink'
            }`}
          >
            Take Picture
          </button>
          <button
            onClick={() => { setUploadMode('presets'); stopCamera(); }}
            className={`py-3 border-b-2 transition-all cursor-pointer ${
              uploadMode === 'presets' ? 'border-sap text-sap bg-paper' : 'border-transparent text-mut hover:text-ink'
            }`}
          >
            Presets Gallery
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 min-h-[300px]">
          {/* Pending Uploads Queue Box */}
          {pendingList.length > 0 && (
            <div id="pending-uploads-queue-container" className="p-4 bg-emsoft/20 border border-em/15 text-ink rounded-2xl flex flex-col gap-2.5 animate-fade-in">
              <div className="flex gap-2.5 items-start">
                <div className="p-1 bg-emsoft rounded-lg text-em flex-shrink-0">
                  <Wifi className="w-4 h-4 animate-pulse" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-ink leading-normal flex items-center gap-1.5">
                    Pending Offline Uploads ({pendingList.length})
                    <span className="text-[9px] bg-emsoft text-em px-1.5 py-0.2 rounded font-extrabold uppercase">Retry Pending</span>
                  </h4>
                  <p className="text-[11px] text-mut mt-0.5 leading-relaxed">
                    You have photo(s) stored in local storage cache waiting to sync.
                    {retryFeedback && <span className="block mt-1 font-semibold text-em">{retryFeedback}</span>}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end items-center">
                <button
                  id="pending-clear-btn"
                  onClick={clearPendingUploads}
                  className="px-2.5 py-1 text-ruby hover:bg-rubysoft border border-transparent rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  title="Remove from queue"
                >
                  Clear Queue
                </button>
                <button
                  id="pending-retry-btn"
                  disabled={isRetrying}
                  onClick={handleRetryPending}
                  className="px-3 py-1 bg-sap text-white rounded-lg text-[10px] font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isRetrying ? (
                    <>Syncing...</>
                  ) : (
                    <>
                      <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                      Sync with Server
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Upload Error / Fallback Warning Banner */}
          {uploadError && (
            <div className="p-4 bg-amsoft border border-am/25 text-ink rounded-2xl flex flex-col gap-2.5 animate-fade-in">
              <div className="flex gap-2.5 items-start">
                <div className="p-1 bg-white dark:bg-zinc-800 rounded-lg text-am flex-shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink leading-normal">
                    Server Upload Offline (HTTP {uploadError.networkStatus || 'Failed'})
                  </h4>
                  <p className="text-[11px] text-mut mt-0.5 leading-relaxed">
                    {uploadError.message}. However, your image was <strong>successfully preserved in local storage cache</strong>. You can proceed with the offline copy, or retry.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setUploadError(null)}
                  className="px-3 py-1 bg-white border border-line rounded-lg text-[10px] font-bold text-ink hover:bg-soft transition-all cursor-pointer"
                >
                  Clear & Retry
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1 bg-am text-ink rounded-lg text-[10px] font-bold hover:opacity-90 transition-all cursor-pointer"
                >
                  Accept Offline Copy & Close
                </button>
              </div>
            </div>
          )}
          {/* File Upload Mode */}
          {uploadMode === 'file' && !previewUrl && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all flex flex-col items-center justify-center gap-3 cursor-pointer ${
                dragOver ? 'border-sap bg-sap/5' : 'border-line hover:border-mut bg-soft/30'
              }`}
              onClick={() => document.getElementById('photo-file-input')?.click()}
            >
              <input
                id="photo-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-full bg-soft border border-line flex items-center justify-center text-mut shadow-sm">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-ink block">Drag and drop photo here</span>
                <span className="text-[10px] text-mut mt-1 block">or click to browse local files</span>
              </div>
            </div>
          )}

          {/* Camera Mode */}
          {uploadMode === 'camera' && !previewUrl && (
            <div className="relative rounded-2xl overflow-hidden bg-black border border-line aspect-video flex flex-col justify-center items-center">
              {cameraError ? (
                <div className="p-5 text-center space-y-2">
                  <Camera className="w-8 h-8 text-am mx-auto" />
                  <p className="text-xs text-zinc-300 font-medium">{cameraError}</p>
                  <button 
                    onClick={() => { setUploadMode('file'); }}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Switch to File Upload
                  </button>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    {cameraActive && (
                      <button
                        onClick={capturePhoto}
                        className="w-12 h-12 rounded-full bg-white border-4 border-emerald-500/30 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                      >
                        <span className="w-5 h-5 rounded-full bg-emerald-500" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Presets Gallery Mode */}
          {uploadMode === 'presets' && !previewUrl && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GALLERY_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => applyPresetImage(idx)}
                  className={`border text-left rounded-xl p-3 bg-paper transition-all hover:border-mut flex items-center gap-3 cursor-pointer ${
                    selectedPresetIdx === idx ? 'border-sap ring-1 ring-sap bg-sap/5' : 'border-line'
                  }`}
                >
                  <div 
                    className="w-12 h-12 rounded-lg border relative flex-shrink-0"
                    style={{ background: p.gradient }}
                  />
                  <div>
                    <h4 className="text-xs font-bold text-ink leading-normal">{p.name}</h4>
                    <p className="text-[10px] text-mut mt-0.5 leading-snug">{p.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Image Preview Panel */}
          {previewUrl && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-line bg-soft">
                <img 
                  src={previewUrl} 
                  alt="Attachment Preview" 
                  className="w-full max-h-72 object-contain mx-auto"
                />
                <button
                  onClick={() => {
                    setPreviewUrl(null);
                    setSelectedPresetIdx(null);
                    if (uploadMode === 'camera') startCamera();
                  }}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form parameters */}
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-mut uppercase tracking-wider block mb-1">
                    Photo Name
                  </label>
                  <input
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs font-semibold text-ink focus:border-sap outline-none"
                    placeholder="e.g. kitchen-island.jpg"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-line bg-soft flex justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-paper border border-line rounded-xl text-xs font-bold text-ink hover:bg-soft transition-all cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            disabled={!previewUrl || isUploading}
            onClick={handleSave}
            className="px-5 py-2 bg-sap text-white font-bold rounded-xl text-xs hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isUploading ? (
              <>Uploading...</>
            ) : (
              <>
                <Check className="w-4.5 h-4.5 stroke-[2.5px]" />
                Add to Job Records
              </>
            )}
          </button>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
