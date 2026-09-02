import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { 
  FileText, 
  Download, 
  Printer, 
  Check, 
  RefreshCw, 
  Signature, 
  Trash2, 
  Save, 
  Lock, 
  FileSpreadsheet, 
  Receipt,
  UserCheck
} from 'lucide-react';
import { Job, Material, Invoice } from '../types';
import { dbSync as dbMock } from '../lib/dbSync';
import { useCurrency, getCurrencyInfo } from '../lib/currency';

interface SupplierInvoiceTemplateProps {
  job: Job;
  materials: Material[];
  currentUser?: any;
  onToast?: (msg: string, isWarn?: boolean) => void;
  onSaveSuccess?: () => void;
}

interface DocketRow {
  itemNo: number;
  supplier: string;
  colour: string;
  qty: string;
  pickupAddress: string;
  load: string;
  unitPrice?: string; // Optional financial field
}

// Supplier address lookup dictionary for automated smart-fill
const SUPPLIER_ADDRESSES: { [key: string]: string } = {
  'Art Of Marble': '11 Yulong Close, Moorebank. 2170',
  'Avenza stone': '2-4 Cullen Place, Smithfield',
  'Avenza': '2-4 Cullen Place, Smithfield',
  'StoneCraft Ltd': '45 Powers Rd, Seven Hills NSW 2147',
  'Marble Depot': '12-14 Bridge St, Rydalmere NSW 2116',
  'Cosentino UK': '15-17 Heald Rd, Ingleburn NSW 2565',
  'Cosentino': '15-17 Heald Rd, Ingleburn NSW 2565',
  'Slabs for Rob': '11 Yulong Close, Moorebank. 2170'
};

export const SupplierInvoiceTemplate: React.FC<SupplierInvoiceTemplateProps> = ({ job, materials, currentUser, onToast, onSaveSuccess }) => {
  const { currency, format } = useCurrency();
  const { symbol, rate } = getCurrencyInfo();

  const [docketDate, setDocketDate] = useState<string>(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  });

  const [rows, setRows] = useState<DocketRow[]>([
    { itemNo: 1, supplier: '', colour: '', qty: '', pickupAddress: '', load: '', unitPrice: '450' },
    { itemNo: 2, supplier: '', colour: '', qty: '', pickupAddress: '', load: '', unitPrice: '380' },
    { itemNo: 3, supplier: '', colour: '', qty: '', pickupAddress: '', load: '', unitPrice: '0' },
    { itemNo: 4, supplier: '', colour: '', qty: '', pickupAddress: '', load: '', unitPrice: '0' }
  ]);

  // Financial mechanics
  const [showFinancials, setShowFinancials] = useState<boolean>(false);
  const [invoiceNotes, setInvoiceNotes] = useState<string>('');
  const [subtotal, setSubtotal] = useState<number>(0);
  const [gst, setGst] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);

  // Signature state
  const [signatureName, setSignatureName] = useState<string>('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [signedAt, setSignedAt] = useState<string>('');
  const [signedByRole, setSignedByRole] = useState<string>('');

  // Interactive signing workflow controls
  const [isSigningOpen, setIsSigningOpen] = useState<boolean>(false);
  const [signType, setSignType] = useState<'draw' | 'type'>('type');
  const [typedName, setTypedName] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Local Save Feedback indicators
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Synchronize or pull material and supplier data from dbMock or fallback
  const loadInitialData = () => {
    const invoices = dbMock.getInvoices();
    const existing = invoices.find(inv => inv.job_id === job.id);
    
    if (existing) {
      if (existing.docket_rows_json) {
        try {
          const parsed = JSON.parse(existing.docket_rows_json);
          setRows(parsed);
        } catch (e) {
          console.error("Failed to parse existing docket rows", e);
          loadRowsFromMaterials();
        }
      } else {
        loadRowsFromMaterials();
      }
      setInvoiceNotes(existing.invoice_notes || '');
      setSignatureName(existing.signature_name || '');
      setSignatureDataUrl(existing.signature_data_url || '');
      setSignedAt(existing.signed_at || '');
      setSignedByRole(existing.signed_by_role || '');
      setShowFinancials(existing.subtotal_amount !== undefined && existing.subtotal_amount > 0);
    } else {
      loadRowsFromMaterials();
      setInvoiceNotes('');
      setSignatureName('');
      setSignatureDataUrl('');
      setSignedAt('');
      setSignedByRole('');
      setShowFinancials(false);
    }
  };

  const loadRowsFromMaterials = () => {
    const jobMats = materials.filter(m => m.job_id === job.id);
    
    let initialRows: DocketRow[] = [
      { itemNo: 1, supplier: '', colour: '', qty: '', pickupAddress: '', load: '', unitPrice: '450' },
      { itemNo: 2, supplier: '', colour: '', qty: '', pickupAddress: '', load: '', unitPrice: '380' },
      { itemNo: 3, supplier: '', colour: '', qty: '', pickupAddress: '', load: '', unitPrice: '0' },
      { itemNo: 4, supplier: '', colour: '', qty: '', pickupAddress: '', load: '', unitPrice: '0' }
    ];

    if (job.id === 'SF-1042' || job.client_name?.toLowerCase().includes('nero') || job.client_name?.toLowerCase().includes('marquina')) {
      initialRows[0] = {
        itemNo: 1,
        supplier: 'Art Of Marble',
        colour: 'Slabs for Rob Sublimis Stone',
        qty: '5',
        pickupAddress: '11 Yulong Close, Moorebank. 2170',
        load: '1',
        unitPrice: '520'
      };
      initialRows[1] = {
        itemNo: 2,
        supplier: 'Avenza stone',
        colour: 'TAJ MAHAL QUARTZITE INV 1353',
        qty: '20',
        pickupAddress: '2-4 Cullen Place, Smithfield',
        load: '2',
        unitPrice: '180'
      };
    } else {
      jobMats.forEach((m, idx) => {
        if (idx < 4) {
          const supplierName = m.supplier || 'Warehouse Direct';
          const qtyVal = parseInt(m.quantity) ? String(parseInt(m.quantity)) : m.quantity || '1';
          const matchedAddress = m.supplier_address || SUPPLIER_ADDRESSES[supplierName] || '—';
          initialRows[idx] = {
            itemNo: idx + 1,
            supplier: supplierName,
            colour: `${m.brand || ''} ${m.color || ''}`.trim() || 'Custom Stone Slabs',
            qty: qtyVal,
            pickupAddress: matchedAddress,
            load: String(idx + 1),
            unitPrice: '450'
          };
        }
      });

      if (jobMats.length === 0) {
        initialRows[0] = {
          itemNo: 1,
          supplier: 'Art Of Marble',
          colour: 'Slabs for ' + (job.client_name || 'Rob'),
          qty: '5',
          pickupAddress: '11 Yulong Close, Moorebank. 2170',
          load: '1',
          unitPrice: '520'
        };
        initialRows[1] = {
          itemNo: 2,
          supplier: 'Avenza stone',
          colour: 'TAJ MAHAL QUARTZITE INV 1353',
          qty: '20',
          pickupAddress: '2-4 Cullen Place, Smithfield',
          load: '2',
          unitPrice: '180'
        };
      }
    }
    setRows(initialRows);
  };

  useEffect(() => {
    loadInitialData();
  }, [job.id, materials]);

  // Calculate pricing
  useEffect(() => {
    let sub = 0;
    rows.forEach(r => {
      const q = parseFloat(r.qty) || 0;
      const p = parseFloat(r.unitPrice || '') || 0;
      sub += q * p;
    });
    
    if (sub === 0 && showFinancials) {
      sub = job.value || 2500;
    }
    
    setSubtotal(sub);
    setGst(sub * 0.1);
    setTotal(sub * 1.1);
  }, [rows, showFinancials, job.value]);

  // Enforce only owner role can see sensitive financial details
  useEffect(() => {
    if (currentUser?.role !== 'owner') {
      setShowFinancials(false);
    }
  }, [currentUser]);

  const handleCellChange = (index: number, field: keyof DocketRow, value: string) => {
    const updatedRows = [...rows];
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: value
    };

    // Auto-fill address if supplier name changes and matches a known address
    if (field === 'supplier') {
      const trimmedVal = value.trim();
      const matchedAddr = SUPPLIER_ADDRESSES[trimmedVal];
      if (matchedAddr) {
        updatedRows[index].pickupAddress = matchedAddr;
      }
    }

    setRows(updatedRows);
  };

  // Canvas Drawing mechanics for electronic signature
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = '#020617'; // Slate 950
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
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

  // Process and save digital signature
  const handleConfirmSignature = () => {
    const today = new Date();
    const timestamp = today.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }) + ' AEST';
    const roleStr = currentUser?.role ? currentUser.role.toUpperCase() : 'OFFICE ADMIN';
    
    if (signType === 'type') {
      if (!typedName.trim()) return;
      setSignatureName(typedName);
      setSignatureDataUrl(''); // clear drawing
      setSignedAt(timestamp);
      setSignedByRole(roleStr);
    } else {
      const canvas = canvasRef.current;
      if (canvas) {
        const url = canvas.toDataURL('image/png');
        setSignatureName(currentUser?.name || 'Authorized Officer');
        setSignatureDataUrl(url);
        setSignedAt(timestamp);
        setSignedByRole(roleStr);
      }
    }
    
    setIsSigningOpen(false);
  };

  const handleClearSignature = () => {
    setSignatureName('');
    setSignatureDataUrl('');
    setSignedAt('');
    setSignedByRole('');
  };

  // Persist customized docket & signature state back to database sync
  const handleSaveToCloud = async () => {
    setIsSaving(true);
    try {
      // 1. Save invoice docket details
      await dbMock.saveInvoiceDocket(job.id, {
        docket_rows_json: JSON.stringify(rows),
        subtotal_amount: showFinancials ? subtotal : undefined,
        gst_amount: showFinancials ? gst : undefined,
        total_amount: showFinancials ? total : undefined,
        invoice_notes: invoiceNotes,
        signature_name: signatureName,
        signature_data_url: signatureDataUrl || undefined,
        signed_at: signedAt || undefined,
        signed_by_role: signedByRole || undefined,
        amount: showFinancials ? total : job.value || 2500,
        status: signedAt ? 'paid' : 'sent'
      });

      // 2. Also update actual materials in database for consistency!
      const currentDbMaterials = dbMock.getMaterials().filter(m => m && m.job_id === job.id);
      for (const [idx, row] of rows.entries()) {
        // Only sync rows that have some content (e.g. supplier or colour is filled)
        if (!row.supplier && !row.colour) continue;

        if (idx < currentDbMaterials.length) {
          const mat = currentDbMaterials[idx];
          await dbMock.updateMaterialById(mat.id, {
            supplier: row.supplier,
            color: row.colour,
            quantity: row.qty,
            supplier_address: row.pickupAddress
          });
        } else {
          // If a new row was added, create a new material record
          await dbMock.createMaterial({
            job_id: job.id,
            type: 'Natural Stone',
            color: row.colour || 'Custom Stone Slabs',
            brand: '',
            slab_id: `Slab-${idx + 1}`,
            quantity: row.qty || '1',
            dimensions: 'Standard Slab',
            supplier: row.supplier || 'Warehouse Direct',
            supplier_address: row.pickupAddress || '',
            material_detail: 'Supplier material from custom invoice docket',
            available: true,
            status: 'reserved'
          });
          onToast?.(`Completed Task: Create Material - ${row.colour || 'Custom Stone Slabs'}`);
        }
      }

      // Log activity
      await dbMock.logActivity(
        job.id, 
        currentUser?.id || 'u-2', 
        `Updated and electronic sign-off logged on Supplier Material Pickup Docket`
      );

      setSaveSuccess(true);
      onToast?.(`Completed Task: Save Invoice Docket - ${job.client_name}`);
      onSaveSuccess?.();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save invoice docket directly to database:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Programmatic high-fidelity PDF download with financial details capability
  const handleDownloadPDF = () => {
    downloadSupplierInvoicePDF(job, docketDate, rows, {
      showFinancials,
      subtotal,
      gst,
      total,
      notes: invoiceNotes,
      signatureName,
      signatureDataUrl,
      signedAt,
      signedByRole
    });
  };

  // Determine if active user is an Admin/Owner authorized to sign and edit
  const canUserSign = currentUser?.role === 'owner' || currentUser?.role === 'office';

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 max-w-5xl mx-auto shadow-md space-y-6 font-sans print:border-none print:p-0 print:shadow-none text-zinc-900">
      
      {/* Interactive Controls Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200/60 gap-4 print:hidden">
        <div className="flex items-center gap-2.5">
          <span className="p-2 bg-yellow-500/10 text-yellow-600 rounded-xl">
            <FileSpreadsheet className="w-5 h-5" />
          </span>
          <div>
            <h4 className="text-xs font-bold text-zinc-800">Smart Logistics Billing Hub</h4>
            <p className="text-[10px] text-zinc-500">Enable pricing calculations, log dispatch notes, and apply legally binding signature sign-offs</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Financials Toggle */}
          <button
            onClick={() => setShowFinancials(!showFinancials)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              showFinancials 
                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700' 
                : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            {showFinancials ? 'Hide Pricing Columns' : 'Show Financial Columns'}
          </button>

          <button
            onClick={loadInitialData}
            title="Reset to database state"
            className="p-2 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50 rounded-lg transition-colors cursor-pointer border border-zinc-200 bg-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          
          <button
            onClick={handleDownloadPDF}
            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Docket
          </button>

          {/* PERSIST TO BACKEND SYNC BUTTON */}
          <button
            onClick={handleSaveToCloud}
            disabled={isSaving}
            className={`px-4 py-1.5 text-xs font-black rounded-lg flex items-center gap-1.5 cursor-pointer transition-all ${
              saveSuccess 
                ? 'bg-emerald-600 text-white' 
                : 'bg-black hover:bg-zinc-800 text-white'
            }`}
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saveSuccess ? 'Saved to Cloud!' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* RENDER VIEW matching the spreadsheet layout exactly */}
      <div className="relative p-6 sm:p-10 border border-zinc-300 bg-white rounded-2xl shadow-sm print:border-none print:p-0 max-w-4xl mx-auto">
        
        {/* Top Header Row containing Logo, Company details and Black Materials Badge */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6">
          
          {/* Company Brand Block & Royal Lion Seal Logo */}
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[3px] border-double border-zinc-400 flex items-center justify-center bg-white p-1 select-none flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-800">
                <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1" />
                <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 1" />
                
                <path id="royalTextPath" d="M 22 50 A 28 28 0 0 1 78 50" fill="none" />
                <path id="marbleTextPath" d="M 78 50 A 28 28 0 0 1 22 50" fill="none" />
                
                <text className="font-serif font-black text-[7.5px] tracking-[0.25em]" fill="currentColor">
                  <textPath href="#royalTextPath" startOffset="50%" textAnchor="middle">ROYAL</textPath>
                </text>
                <text className="font-serif font-black text-[5.5px] tracking-[0.1em]" fill="currentColor">
                  <textPath href="#marbleTextPath" startOffset="50%" textAnchor="middle">GRANITE & MARBLE</textPath>
                </text>
                
                <g transform="translate(32, 34) scale(0.38)" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M 20 10 L 25 22 L 35 15 L 45 22 L 50 10 L 52 30 L 18 30 Z" fill="currentColor" strokeWidth="1" />
                  <path d="M 22 30 C 15 35 12 45 15 55 C 18 65 30 75 42 72 C 38 68 37 60 40 55 C 32 55 30 48 33 42 C 35 39 40 38 42 35 C 38 34 32 32 30 25" />
                  <path d="M 33 42 L 23 44" />
                  <circle cx="28" cy="48" r="1.5" fill="currentColor" />
                  <circle cx="31" cy="49" r="1.5" fill="currentColor" />
                  <circle cx="26" cy="38" r="2" fill="currentColor" />
                </g>
              </svg>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-black text-zinc-900 tracking-tight font-serif uppercase leading-none">
                Royal Granite &amp; Marble
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-600 font-medium leading-normal">
                Factory 1-3/51 Holbeche Rd Arndell Park<br />
                NSW 2148 <span className="mx-1.5">|</span> Ph: 02 9624 4966
              </p>
            </div>
          </div>

          {/* Solid Black Badge on top right */}
          <div className="bg-black text-white px-6 sm:px-8 py-4 sm:py-5 rounded-sm shadow-md text-center border border-zinc-800 min-w-[200px] sm:min-w-[240px] flex-shrink-0 self-stretch sm:self-auto flex flex-col justify-center items-center">
            <span className="text-xs sm:text-sm font-black tracking-[0.25em] text-yellow-400 block font-sans uppercase">
              {showFinancials ? 'SUPPLIER' : 'MATERIALS'}
            </span>
            <span className="text-xs sm:text-sm font-black tracking-[0.25em] text-yellow-400 block mt-1 font-sans uppercase">
              {showFinancials ? 'INVOICE' : 'PICKUP DOCKET'}
            </span>
          </div>

        </div>

        {/* Date Row with interactive input */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-black tracking-widest text-zinc-700 uppercase font-sans">
              DATE:
            </label>
            <input
              type="text"
              value={docketDate}
              onChange={(e) => setDocketDate(e.target.value)}
              className="border-none font-sans font-bold text-sm text-zinc-800 bg-transparent focus:ring-0 focus:outline-none p-0 w-36 border-b border-dashed border-zinc-400 focus:border-zinc-800"
              placeholder="DD/MM/YYYY"
            />
          </div>
          <div className="text-xs font-semibold text-zinc-700 bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200">
            Job ID: <span className="font-bold text-zinc-900">{job.id}</span> • Client: <span className="font-bold text-zinc-900">{job.client_name}</span>
          </div>
        </div>

        {/* Material & Scope Specifications */}
        {(job.material || job.job_type) && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 mb-5 space-y-1">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">
              Material &amp; Scope Specs
            </span>
            <p className="text-xs font-bold text-zinc-800 leading-relaxed">
              {job.material ? `${job.job_type || 'Custom Work'} — ${job.material}` : (job.job_type || 'Stone Fabrication')}
            </p>
            {job.site_address && (
              <p className="text-[11px] text-zinc-500 font-normal pt-1 border-t border-zinc-200/80">
                <strong>Site Address: </strong>{job.site_address}
              </p>
            )}
          </div>
        )}

        {/* Spreadsheet-styled Table */}
        <div className="overflow-x-auto border border-zinc-400 rounded-sm">
          <table className="w-full border-collapse text-xs select-none min-w-[650px]">
            <thead>
              <tr className="bg-black border-b border-zinc-400 text-yellow-400 font-extrabold font-sans text-center">
                <th className="py-2.5 px-3 border-r border-zinc-400 text-[11px] font-black w-[8%]">Item No</th>
                <th className="py-2.5 px-3 border-r border-zinc-400 text-[11px] font-black w-[22%] text-left">Supplier</th>
                <th className="py-2.5 px-3 border-r border-zinc-400 text-[11px] font-black w-[25%] text-left">Colour</th>
                <th className="py-2.5 px-3 border-r border-zinc-400 text-[11px] font-black w-[10%]">Qty</th>
                
                {/* Dynamically swap columns based on Show Pricing toggle */}
                {!showFinancials ? (
                  <>
                    <th className="py-2.5 px-3 border-r border-zinc-400 text-[11px] font-black w-[27%] text-left">Pickup Address</th>
                    <th className="py-2.5 px-3 text-[11px] font-black w-[8%]">Load</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-3 border-r border-zinc-400 text-[11px] font-black w-[17%] text-right">Unit Price ({symbol})</th>
                    <th className="py-2.5 px-3 text-[11px] font-black w-[18%] text-right">Ext Total ({symbol})</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                let rowBgClass = 'bg-white';
                if (idx === 0) {
                  rowBgClass = 'bg-[#F2D636]/30 hover:bg-[#F2D636]/45'; // Excel gold
                } else if (idx === 1) {
                  rowBgClass = 'bg-[#F9EAA5]/30 hover:bg-[#F9EAA5]/45'; // Cream
                } else {
                  rowBgClass = 'bg-white hover:bg-zinc-50';
                }

                const calculatedExt = (parseFloat(row.qty) || 0) * (parseFloat(row.unitPrice || '0') || 0) * rate;

                return (
                  <tr key={idx} className={`${rowBgClass} border-b border-zinc-400 transition-colors`}>
                    {/* Item No */}
                    <td className="py-3 px-3 text-center border-r border-zinc-400 font-bold text-zinc-800">
                      {row.itemNo}
                    </td>

                    {/* Supplier */}
                    <td className="py-1 px-2 border-r border-zinc-400">
                      <input
                        type="text"
                        value={row.supplier}
                        onChange={(e) => handleCellChange(idx, 'supplier', e.target.value)}
                        placeholder="..."
                        className="w-full bg-transparent border-none text-zinc-800 focus:ring-0 focus:outline-none p-1 font-bold"
                      />
                    </td>

                    {/* Colour */}
                    <td className="py-1 px-2 border-r border-zinc-400">
                      <input
                        type="text"
                        value={row.colour}
                        onChange={(e) => handleCellChange(idx, 'colour', e.target.value)}
                        placeholder="..."
                        className="w-full bg-transparent border-none text-zinc-800 focus:ring-0 focus:outline-none p-1 font-semibold"
                      />
                    </td>

                    {/* Qty */}
                    <td className="py-1 px-2 border-r border-zinc-400 text-center">
                      <input
                        type="text"
                        value={row.qty}
                        onChange={(e) => handleCellChange(idx, 'qty', e.target.value)}
                        placeholder="0"
                        className="w-full bg-transparent border-none text-zinc-800 text-center font-bold focus:ring-0 focus:outline-none p-1"
                      />
                    </td>

                    {/* Dynamic Inputs */}
                    {!showFinancials ? (
                      <>
                        {/* Pickup Address */}
                        <td className="py-1 px-2 border-r border-zinc-400">
                          <input
                            type="text"
                            value={row.pickupAddress}
                            onChange={(e) => handleCellChange(idx, 'pickupAddress', e.target.value)}
                            placeholder="..."
                            className="w-full bg-transparent border-none text-zinc-700 focus:ring-0 focus:outline-none p-1 text-[11px]"
                          />
                        </td>

                        {/* Load */}
                        <td className="py-1 px-2 text-center">
                          <input
                            type="text"
                            value={row.load}
                            onChange={(e) => handleCellChange(idx, 'load', e.target.value)}
                            placeholder="..."
                            className="w-full bg-transparent border-none text-zinc-800 text-center font-bold focus:ring-0 focus:outline-none p-1"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Unit Price */}
                        <td className="py-1 px-2 border-r border-zinc-400 text-right">
                          <div className="flex items-center justify-end">
                            <span className="text-zinc-400 font-semibold mr-0.5">{symbol}</span>
                            <input
                              type="text"
                              value={row.unitPrice || '0'}
                              onChange={(e) => handleCellChange(idx, 'unitPrice', e.target.value)}
                              className="bg-transparent border-none text-zinc-800 text-right font-bold focus:ring-0 focus:outline-none p-1 w-20"
                            />
                          </div>
                        </td>

                        {/* Ext Total */}
                        <td className="py-1.5 px-3 text-right font-bold text-zinc-900 bg-zinc-50/40">
                          {symbol}{calculatedExt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pricing Subtotal / GST blocks and Delivery Notes */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start text-left">
          
          {/* Dispatcher Instructions / Invoice Notes */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Special Handling &amp; Logistics Notes</span>
            <textarea
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Slabs must be loaded on A-frame and secured with safety straps. Call dispatcher on gate clearance..."
              className="w-full border border-zinc-200 bg-zinc-50/30 rounded-xl px-3 py-2 text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-yellow-500/50 resize-none leading-relaxed text-zinc-700"
            />
          </div>

          {/* Totals math card */}
          {showFinancials && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-2 max-w-sm ml-auto w-full select-none">
              <div className="flex justify-between text-xs text-zinc-600">
                <span>Subtotal Amount:</span>
                <span className="font-bold text-zinc-900">{symbol}{(subtotal * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-600 pb-2 border-b border-zinc-200">
                <span>GST (10%):</span>
                <span className="font-bold text-zinc-900">{symbol}{(gst * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-900 font-extrabold pt-1">
                <span className="text-yellow-600 font-black">TOTAL DUE ({currency.toUpperCase()}):</span>
                <span>{symbol}{(total * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </div>

        {/* Terms and Release signature placeholder at bottom */}
        <div className="mt-8 pt-5 border-t border-zinc-200 text-[10px] text-zinc-400 leading-relaxed flex flex-col md:flex-row justify-between gap-6">
          <div className="max-w-lg text-left">
            <p className="font-bold text-zinc-600 mb-1">LOGISTICS &amp; TRANSPORTATION RELEASE WARNINGS</p>
            <p>
              By utilizing this pickup docket, the carrier accepts full transport responsibility of the slabs listed above. All loads must be fully secured on specialized frame racks. Royal Granite &amp; Marble is not liable for structural integrity issues or cracking post-pickup gate clearance.
            </p>
          </div>
          
          {/* INTERACTIVE SIGNATURE BLOCK */}
          <div className="flex flex-col justify-end items-end pr-4 text-right min-w-[240px]">
            <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50/40 w-full flex flex-col items-center justify-center min-h-[90px] relative select-none">
              {signatureName ? (
                <>
                  {/* Signed display */}
                  <div className="flex flex-col items-center justify-center w-full">
                    {signatureDataUrl ? (
                      <img 
                        src={signatureDataUrl} 
                        alt="Signature" 
                        className="h-10 object-contain max-w-[180px] dark:invert" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="font-serif italic text-xl tracking-wider text-indigo-700 select-none font-semibold pr-2 py-2 block">
                        {signatureName}
                      </span>
                    )}
                    <span className="text-[8px] text-zinc-500 font-semibold uppercase mt-1 tracking-wider text-center block">
                      Electronically signed by {signatureName}<br />
                      <span className="text-zinc-400 font-mono text-[7px]">{signedByRole} • {signedAt}</span>
                    </span>
                  </div>

                  {/* Redo trigger (Hidden in print) */}
                  {canUserSign && (
                    <button
                      onClick={handleClearSignature}
                      className="absolute top-1 right-1 p-1 hover:bg-zinc-200 text-red-500 rounded transition-all print:hidden cursor-pointer"
                      title="Revoke Signature"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Unsigned Action Block */}
                  {canUserSign ? (
                    <button
                      onClick={() => setIsSigningOpen(true)}
                      className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-zinc-950 rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer transition-all print:hidden"
                    >
                      <Signature className="w-3.5 h-3.5" />
                      Sign Electronically
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-zinc-400">
                      <Lock className="w-4 h-4 text-zinc-400" />
                      <span className="text-[9px] font-bold uppercase text-center">Auth Officer Restricted</span>
                    </div>
                  )}
                  <span className="text-[8px] text-zinc-400 tracking-widest mt-2 uppercase block print:block font-bold">
                    Authorized Dispatch Signature
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ELECTRONIC SIGNATURE MODAL OVERLAY */}
      {isSigningOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:hidden">
          <div className="bg-white border border-zinc-200 rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="p-5 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center text-left">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-yellow-500/10 text-yellow-600 flex items-center justify-center">
                  <Signature className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900">Authorize Dispatch Signature</h3>
                  <p className="text-[10px] text-zinc-500">Log security sign-off for materials dispatch release</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSigningOpen(false)}
                className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-800 cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Selector */}
            <div className="border-b border-zinc-100 grid grid-cols-2 text-center text-xs font-bold bg-zinc-50/50">
              <button
                onClick={() => setSignType('type')}
                className={`py-3 border-b-2 transition-all cursor-pointer ${
                  signType === 'type' ? 'border-yellow-500 text-zinc-900 bg-white' : 'border-transparent text-zinc-400'
                }`}
              >
                Type My Signature
              </button>
              <button
                onClick={() => { setSignType('draw'); setTimeout(clearCanvas, 50); }}
                className={`py-3 border-b-2 transition-all cursor-pointer ${
                  signType === 'draw' ? 'border-yellow-500 text-zinc-900 bg-white' : 'border-transparent text-zinc-400'
                }`}
              >
                Draw Signature
              </button>
            </div>

            {/* Input fields */}
            <div className="p-5 space-y-4">
              {signType === 'type' ? (
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Authorized Signatory Name</label>
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Enter your full legal name"
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs focus:outline-none focus:border-zinc-800"
                    autoFocus
                  />
                  {typedName && (
                    <div className="mt-3 p-4 border border-zinc-100 rounded-xl bg-zinc-50 flex items-center justify-center min-h-[70px]">
                      <span className="font-serif italic text-2xl tracking-wider text-indigo-700 select-none font-semibold">
                        {typedName}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Draw inside box</label>
                    <button 
                      onClick={clearCanvas}
                      className="text-[10px] text-zinc-400 hover:text-zinc-800 font-bold transition-all cursor-pointer"
                    >
                      Clear Screen
                    </button>
                  </div>
                  <div className="border border-zinc-300 rounded-2xl bg-zinc-50 overflow-hidden relative">
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={150}
                      className="w-full aspect-[38/15] bg-zinc-50 cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>
                </div>
              )}

              <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-3 flex items-start gap-2 text-left select-none">
                <span className="text-amber-600 text-xs mt-0.5">⚠️</span>
                <span className="text-[9px] text-amber-800 leading-normal">
                  You are logging an electronic signature. This logs your username, IP reference, and role credentials directly in the audit trail for this materials order.
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex gap-2 justify-end">
              <button
                onClick={() => setIsSigningOpen(false)}
                className="px-4 py-2 text-zinc-500 hover:text-zinc-800 font-bold text-xs rounded-xl hover:bg-zinc-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSignature}
                disabled={signType === 'type' ? !typedName.trim() : false}
                className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-zinc-950 font-black text-xs rounded-xl cursor-pointer"
              >
                Confirm Signature
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Generates an exact programmatic high-fidelity PDF match of the layout with optional financials and signatures
export function downloadSupplierInvoicePDF(
  job: Job, 
  dateStr: string, 
  rows: DocketRow[],
  options?: {
    showFinancials?: boolean;
    subtotal?: number;
    gst?: number;
    total?: number;
    notes?: string;
    signatureName?: string;
    signatureDataUrl?: string;
    signedAt?: string;
    signedByRole?: string;
  }
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const blackColor = [0, 0, 0];
  const goldColor = [242, 214, 54]; // Excel gold yellow
  const lightGoldColor = [249, 234, 165]; // Lighter excel cream highlight
  const gridColor = [100, 100, 100]; // Fine dark gray lines

  // 1. DRAW COMPANY BRAND HEADER & LION LOGO (LEFT)
  
  // Outer double ring circles for Royal Seal
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.8);
  doc.circle(30, 30, 18); // Outer thick ring
  
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.5, 1], 0);
  doc.circle(30, 30, 16); // Inner dashed ring
  doc.setLineDashPattern([], 0); // Reset dash

  // Central crowned lion avatar paths (represented cleanly with circles/triangles)
  doc.setFillColor(30, 30, 30);
  // Lion Crown
  doc.triangle(24, 25, 26, 21, 28, 25, 'F');
  doc.triangle(28, 25, 30, 20, 32, 25, 'F');
  doc.triangle(32, 25, 34, 21, 36, 25, 'F');
  doc.rect(24, 25, 12, 1.5, 'F');

  // Lion head face
  doc.ellipse(30, 31, 5, 4.5, 'F');
  doc.rect(25.5, 31, 8.5, 6, 'F');
  // Mane lines
  doc.setLineWidth(0.5);
  doc.setDrawColor(30, 30, 30);
  doc.line(25, 35, 23, 41);
  doc.line(28, 37, 27, 43);
  doc.line(31, 37, 31, 44);
  doc.line(34, 36, 35, 42);

  // Curved Seal Texts
  doc.setFont('times', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(30, 30, 30);
  doc.text('ROYAL', 30, 16, { align: 'center' });
  doc.setFontSize(4);
  doc.text('GRANITE & MARBLE', 30, 45, { align: 'center' });

  // Company Name & Info Text
  doc.setFont('serif', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text('ROYAL GRANITE & MARBLE', 52, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(80, 80, 80);
  doc.text([
    'Factory 1-3/51 Holbeche Rd Arndell Park',
    'NSW 2148        Ph: 02 9624 4966'
  ], 52, 30);

  // 2. DRAW BLACK BADGE (RIGHT)
  doc.setFillColor(0, 0, 0);
  doc.rect(130, 14, 65, 23, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
  
  const badgeTitle1 = options?.showFinancials ? 'SUPPLIER' : 'MATERIALS';
  const badgeTitle2 = options?.showFinancials ? 'INVOICE' : 'PICKUP DOCKET';
  doc.text(badgeTitle1, 162.5, 22.5, { align: 'center' });
  doc.text(badgeTitle2, 162.5, 29.5, { align: 'center' });

  // 3. DATE SECTION
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`DATE:  ${dateStr}`, 15, 52);
  
  doc.setLineWidth(0.3);
  doc.setDrawColor(180, 180, 180);
  doc.line(28, 53, 130, 53); // Underline date row

  // 4. DRAW SPREADSHEET TABLE
  const startX = 15;
  const startY = 62;
  
  // Decide columns layout based on showFinancials toggle option
  const showFinancials = !!options?.showFinancials;
  const colWidths = showFinancials 
    ? [15, 45, 55, 15, 25, 25] // Sums to 180mm
    : [15, 45, 50, 18, 42, 10]; // Sums to 180mm
    
  const rowHeight = 11;
  const { code: currencyCode, symbol: currencySymbol, rate: currencyRate } = getCurrencyInfo();
  const headers = showFinancials
    ? ['Item No', 'Supplier', 'Colour', 'Qty', `Unit Price (${currencySymbol})`, `Ext Total (${currencySymbol})`]
    : ['Item No', 'Supplier', 'Colour', 'Qty', 'Pickup Address', 'Load'];

  // Draw Table Headers (Black bg, gold text)
  doc.setFillColor(0, 0, 0);
  doc.rect(startX, startY, 180, 9, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);

  let currentX = startX;
  headers.forEach((h, i) => {
    const width = colWidths[i];
    // Alignments: numeric values and centers
    const alignOpt = showFinancials
      ? (i === 0 || i === 3) ? 'center' : (i >= 4 ? 'right' : 'left')
      : (i === 0 || i === 3 || i === 5) ? 'center' : 'left';
      
    const textX = alignOpt === 'center' 
      ? currentX + (width / 2) 
      : (alignOpt === 'right' ? currentX + width - 3 : currentX + 3);
      
    doc.text(h, textX, startY + 6, { align: alignOpt as any });
    currentX += width;
  });

  // Draw Rows
  let currentY = startY + 9;
  doc.setFontSize(8);

  rows.forEach((row, rowIndex) => {
    // Fill row backgrounds based on image's highlighted rows
    if (rowIndex === 0) {
      doc.setFillColor(goldColor[0], goldColor[1], goldColor[2]); // Excel yellow for Row 1
      doc.rect(startX, currentY, 180, rowHeight, 'F');
    } else if (rowIndex === 1) {
      doc.setFillColor(lightGoldColor[0], lightGoldColor[1], lightGoldColor[2]); // Lighter cream for Row 2
      doc.rect(startX, currentY, 180, rowHeight, 'F');
    }

    doc.setTextColor(0, 0, 0);
    
    // Cell 1: Item No
    doc.setFont('helvetica', 'bold');
    doc.text(String(row.itemNo), startX + (colWidths[0] / 2), currentY + 7, { align: 'center' });

    // Cell 2: Supplier
    doc.setFont('helvetica', 'bold');
    doc.text(row.supplier, startX + colWidths[0] + 3, currentY + 7);

    // Cell 3: Colour (Medium)
    doc.setFont('helvetica', 'normal');
    doc.text(row.colour, startX + colWidths[0] + colWidths[1] + 3, currentY + 7);

    // Cell 4: Qty (Bold, centered)
    doc.setFont('helvetica', 'bold');
    doc.text(row.qty, startX + colWidths[0] + colWidths[1] + colWidths[2] + (colWidths[3] / 2), currentY + 7, { align: 'center' });

    if (!showFinancials) {
      // Cell 5: Pickup Address
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(row.pickupAddress, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 3, currentY + 7);
      doc.setFontSize(8); // Reset
  
      // Cell 6: Load
      doc.setFont('helvetica', 'bold');
      doc.text(row.load, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + (colWidths[5] / 2), currentY + 7, { align: 'center' });
    } else {
      // Cell 5: Unit Price
      doc.setFont('helvetica', 'bold');
      const up = (parseFloat(row.unitPrice || '0') || 0) * currencyRate;
      doc.text(`${currencySymbol}${up.toFixed(2)}`, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] - 3, currentY + 7, { align: 'right' });

      // Cell 6: Ext Total
      const ext = ((parseFloat(row.qty) || 0) * (parseFloat(row.unitPrice || '0') || 0)) * currencyRate;
      doc.text(`${currencySymbol}${ext.toFixed(2)}`, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] - 3, currentY + 7, { align: 'right' });
    }

    currentY += rowHeight;
  });

  // 5. DRAW TABLE GRID LINES
  doc.setDrawColor(gridColor[0], gridColor[1], gridColor[2]);
  doc.setLineWidth(0.35);

  // Outer boundary rectangle
  doc.rect(startX, startY, 180, 9 + (rows.length * rowHeight), 'S');

  // Vertical dividers
  let dividerX = startX;
  for (let idx = 0; idx < colWidths.length - 1; idx++) {
    dividerX += colWidths[idx];
    doc.line(dividerX, startY, dividerX, startY + 9 + (rows.length * rowHeight));
  }

  // Horizontal rows
  let lineY = startY + 9;
  for (let idx = 0; idx < rows.length; idx++) {
    doc.line(startX, lineY, startX + 180, lineY);
    lineY += rowHeight;
  }

  // 6. DYNAMIC CALCULATIONS & NOTES DETAILS
  let termsY = currentY + 15;

  if (showFinancials) {
    // Left Block: Dispatcher Notes
    const notesX = startX;
    const notesY = currentY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('SPECIAL HANDLING LOGISTICS NOTES', notesX, notesY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(80, 80, 80);
    const notesLines = doc.splitTextToSize(options?.notes || 'No special handling instructions specified.', 100);
    doc.text(notesLines, notesX, notesY + 4);

    // Right Block: Pricing math
    const mathX = startX + 115;
    const mathY = currentY + 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    
    doc.text('Subtotal Amount:', mathX, mathY);
    doc.text(`${currencySymbol}${(options?.subtotal ? options.subtotal * currencyRate : 0).toFixed(2)}`, startX + 180 - 3, mathY, { align: 'right' });
    
    doc.text('GST (10%):', mathX, mathY + 4.5);
    doc.text(`${currencySymbol}${(options?.gst ? options.gst * currencyRate : 0).toFixed(2)}`, startX + 180 - 3, mathY + 4.5, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`TOTAL DUE (${currencyCode.toUpperCase()}):`, mathX, mathY + 10);
    doc.text(`${currencySymbol}${(options?.total ? options.total * currencyRate : 0).toFixed(2)}`, startX + 180 - 3, mathY + 10, { align: 'right' });

    // Underline totals box
    doc.setDrawColor(200, 200, 200);
    doc.line(mathX, mathY + 11.5, startX + 180, mathY + 11.5);

    termsY = currentY + 24;
  }

  // 7. DRAW RELEASE DETAILS AND SIGN-OFF
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.text('LOGISTICS & TRANSPORTATION RELEASE WARNINGS', startX, termsY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  const legalLines = doc.splitTextToSize(
    'By utilizing this pickup docket, the carrier accepts full transport responsibility of the slabs listed above. All loads must be fully secured on specialized frame racks. Royal Granite & Marble is not liable for structural integrity issues or cracking post-pickup gate clearance.',
    115
  );
  doc.text(legalLines, startX, termsY + 8);

  // Draw Signature line and Electronic Stamp
  const sigLineY = termsY + 16;
  doc.setDrawColor(180, 180, 180);
  doc.line(startX + 125, sigLineY, startX + 175, sigLineY);

  if (options?.signatureName) {
    if (options.signatureDataUrl) {
      // Drawn Signature image
      try {
        doc.addImage(options.signatureDataUrl, 'PNG', startX + 132, sigLineY - 12, 36, 11);
      } catch (err) {
        console.error("Error drawing signature image in PDF", err);
      }
    } else {
      // Typed Signature name
      doc.setFont('times', 'italic');
      doc.setFontSize(12);
      doc.setTextColor(30, 58, 138); // Dark blue / indigo tone
      doc.text(options.signatureName, startX + 150, sigLineY - 3, { align: 'center' });
    }

    // Signatory audit data
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `SIGNED ELECTRONICALLY BY: ${options.signatureName.toUpperCase()}\nROLE: ${options.signedByRole || 'ADMIN'} • DATE: ${options.signedAt}`,
      startX + 150,
      sigLineY + 3,
      { align: 'center' }
    );
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('Authorized Dispatch Signature', startX + 150, sigLineY + 9, { align: 'center' });

  // 8. SAVE THE HIGH FIDELITY PDF
  const filename = showFinancials 
    ? `Supplier_Invoice_${job.id}.pdf`
    : `Supplier_Pickup_Docket_${job.id}.pdf`;
  doc.save(filename);
}
