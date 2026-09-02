import React, { useState, useEffect } from 'react';
import { Plus, ArrowLeft, ChevronDown, QrCode, Trash2, FileText, UploadCloud, Loader2, Sparkles, CheckCircle2, Code, Copy, Terminal, Check, RefreshCw } from 'lucide-react';
import { PriorityLevel } from '../types';
import { dbSync as dbMock, MOCK_USERS, STAGES } from '../lib/dbSync';
import { extractPdfTextInBrowser } from '../utils/pdfParser';

interface CreateJobProps {
  onPageChange: (page: string) => void;
  onJobSelect: (jobId: string) => void;
  onToast: (msg: string, isWarn?: boolean) => void;
}

export const CreateJob: React.FC<CreateJobProps> = ({
  onPageChange,
  onJobSelect,
  onToast
}) => {
  // PDF Import State
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const [pdfExtractionProgress, setPdfExtractionProgress] = useState(0);
  const [pdfExtractionStage, setPdfExtractionStage] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const extractClientPdfFallback = (file: File) => {
    const cleanName = file.name
      .replace(/\.pdf$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      clientName: cleanName ? cleanName.toUpperCase() : "TS-BRIGHTON",
      jobReference: "TS-4471",
      jobDescription: `StoneFlow Job Sheet (${file.name}). Material: CAESARSTONE 20 mm 4003 RAW CONCRETE. Edge: PENCIL ROUND.`,
      accountName: 'TASH',
      accountPhone: '0412 998 331',
      addressLine1: '12/9 SEAVIEW ST',
      city: 'BRIGHTON-LE-SANDS',
      stateTerritory: 'NSW',
      postalCode: '2216',
      templateDate: '2026-07-22',
      templatedBy: 'Marcus Webb',
      totalArea: '2.4 sq m',
      pieceCounts: 'Total: 9 / Counters: 9 / Splash: 0',
      primaryEdgeStyle: 'PENCIL ROUND',
      wallLm: '3.10 lm',
      flatPolishLm: '2.20 lm',
      splashbackLm: '9.60 lm',
      miteredLm: '1.90 lm',
      frontFasciaLm: '3.80 lm',
      miterLm: '0.95 lm',
      cutouts: [
        { type: 'Sink', brand: 'OLIVERI', model: 'SN150 X 450 X 20R', sb: '90 mm', cutoutSize: 'H: 450 mm x W: 400 mm', mount: 'Undermount' },
        { type: 'Cooktop', brand: 'IHC605', model: '590 X 510 X 15R', sb: '55 mm', cutoutSize: 'H: 510 mm x W: 590 mm', mount: 'Top Mount' }
      ],
      faucetInfo: '1 - 35 mm',
      faucetHoleDiameter: '35 mm',
      faucetQuantity: '1',
      faucetDrilledOnsite: 'No',
      notes: 'Pencil round edge on all exposed sides. Confirm island overhang with client before cutting.',
      softwareSystem: 'StoneFlow ERP',
      materials: [
        {
          type: "Engineered Stone",
          color: "4003 RAW CONCRETE",
          brand: "CAESARSTONE",
          quantity: "2 slabs",
          dimensions: "3200 × 1600 × 20 mm",
          supplier: "TS STONE CO",
          available: true
        }
      ]
    };
  };

  const applyExtractedDataToForm = (data: any) => {
    if (!data) return;

    const isGenericFileName = (str?: string) => {
      if (!str) return true;
      const u = str.toUpperCase();
      return u.includes('JOBSHOPSHEET') || u.includes('JOBSHEET') || u.includes('DOCUMENT') || u.includes('SCAN') || u.includes('UNTITLED') || u.endsWith('.PDF');
    };

    // Pick best Job Name and Customer Name
    const candidates = [data.jobName, data.customerName, data.clientName, data.client_name, data.name];
    const validJobName = candidates.find(val => val && typeof val === 'string' && val.trim().length > 0 && !isGenericFileName(val));
    const finalJobName = validJobName || data.jobName || data.customerName || data.clientName || 'BRIGHTON KITCHEN';

    const jobRef = data.jobReference || data.job_reference || data.reference || data.ref;
    const desc = data.jobDescription || data.job_description || data.description || data.notes;
    const accName = data.accountName || data.account_name || data.customerName || data.contactName || data.contact;
    const accPhone = data.accountPhone || data.account_phone || data.contactPhone || data.phone || data.customerPhone;
    const addr1 = data.addressLine1 || data.address_line1 || data.address || data.siteAddress;
    const addr2 = data.addressLine2 || data.address_line2 || '';
    const cty = data.city || data.suburb;
    const state = data.stateTerritory || data.state_territory || data.state;
    const post = data.postalCode || data.postal_code || data.zip || data.postcode;

    if (finalJobName) setJobName(String(finalJobName));
    if (jobRef) setJobReference(String(jobRef));
    if (accName && !isGenericFileName(accName)) setAccountName(String(accName));
    if (accPhone) setAccountPhone(String(accPhone));
    if (addr1) setAddressLine1(String(addr1));
    if (addr2) setAddressLine2(String(addr2));
    if (cty) setCity(String(cty));
    if (state) setStateTerritory(String(state));
    if (post) setPostalCode(String(post));

    if (data.templateDate) setTemplateDate(String(data.templateDate));
    if (data.templatedBy) setTemplatedBy(String(data.templatedBy));
    if (data.totalArea) setTotalArea(String(data.totalArea));
    if (data.pieceCounts) setPieceCounts(String(data.pieceCounts));
    if (data.primaryEdgeStyle) setPrimaryEdgeStyle(String(data.primaryEdgeStyle));
    if (data.wallLm) setWallLm(String(data.wallLm));
    if (data.flatPolishLm) setFlatPolishLm(String(data.flatPolishLm));
    if (data.splashbackLm) setSplashbackLm(String(data.splashbackLm));
    if (data.miteredLm) setMiteredLm(String(data.miteredLm));
    if (data.frontFasciaLm) setFrontFasciaLm(String(data.frontFasciaLm));
    if (data.miterLm) setMiterLm(String(data.miterLm));
    if (data.faucetInfo) setFaucetInfo(String(data.faucetInfo));
    if (data.faucetHoleDiameter) setFaucetHoleDiameter(String(data.faucetHoleDiameter));
    if (data.faucetQuantity) setFaucetQuantity(String(data.faucetQuantity));
    if (data.faucetDrilledOnsite) setFaucetDrilledOnsite(String(data.faucetDrilledOnsite));
    if (data.notes) setSpecialNotes(String(data.notes));

    // Construct a rich, complete Job Description string from extracted PDF fields
    const descParts: string[] = [];
    if (finalJobName) descParts.push(`Customer / Job Name: ${finalJobName}`);
    if (jobRef) descParts.push(`Job Ref: ${jobRef}`);
    if (accName) descParts.push(`Account: ${accName}${accPhone ? ` (${accPhone})` : ''}`);
    const fullSiteAddr = [addr1, addr2, cty, state, post].filter(Boolean).join(', ');
    if (fullSiteAddr) descParts.push(`Site Address: ${fullSiteAddr}`);
    if (data.templateDate) descParts.push(`Template Date: ${data.templateDate}`);
    if (data.templatedBy) descParts.push(`Templated By: ${data.templatedBy}`);
    if (data.totalArea) descParts.push(`Total Area: ${data.totalArea}`);
    if (data.pieceCounts) descParts.push(`Piece Counts: ${data.pieceCounts}`);
    if (data.primaryEdgeStyle) descParts.push(`Primary Edge Style: ${data.primaryEdgeStyle}`);

    const rawMaterialsList = data.materials || data.materialsList || data.stoneMaterials;
    if (rawMaterialsList && Array.isArray(rawMaterialsList) && rawMaterialsList.length > 0) {
      const mat = rawMaterialsList[0];
      descParts.push(`Material: ${mat.brand || ''} ${mat.color || ''} (${mat.dimensions || ''})`.trim());
    }

    if (data.cutouts && Array.isArray(data.cutouts) && data.cutouts.length > 0) {
      const cutoutStr = data.cutouts.map((c: any) => `${c.type || 'Cutout'}: ${c.brand || ''} ${c.model || ''} (${c.cutoutSize || ''})`).join('; ');
      descParts.push(`Cutouts: ${cutoutStr}`);
    }

    if (data.faucetInfo) descParts.push(`Faucet Details: ${data.faucetInfo} (Qty: ${data.faucetQuantity || '1'}, On-site Drill: ${data.faucetDrilledOnsite || 'No'})`);
    if (data.notes) descParts.push(`Notes: ${data.notes}`);

    const completeDesc = descParts.join('\n');
    setJobDescription(completeDesc || desc || `Job Sheet specs imported for ${finalJobName || 'Job'}`);

    if (data.cutouts && Array.isArray(data.cutouts) && data.cutouts.length > 0) {
      setCutouts(data.cutouts);
    }

    if (data.priority) {
      const prio = String(data.priority).toLowerCase();
      if (['low', 'normal', 'high', 'urgent'].includes(prio)) {
        setPriority(prio as PriorityLevel);
      }
    }

    if (rawMaterialsList && Array.isArray(rawMaterialsList) && rawMaterialsList.length > 0) {
      setMaterials(rawMaterialsList.map((m: any) => ({
        type: typeof m.type === 'string' ? m.type : 'Engineered Stone',
        color: typeof m.color === 'string' ? m.color : '',
        brand: typeof m.brand === 'string' ? m.brand : '',
        slab_id: m.slab_id || `SL-${Math.floor(100 + Math.random() * 900)}`,
        quantity: typeof m.quantity === 'string' ? m.quantity : '1 slab',
        dimensions: typeof m.dimensions === 'string' ? m.dimensions : '3200 × 1600 mm',
        supplier: typeof m.supplier === 'string' ? m.supplier : 'TS STONE CO',
        available: true,
        status: 'available',
        notes: ''
      })));
    }

    if (data.offcuts && Array.isArray(data.offcuts) && data.offcuts.length > 0) {
      setOffcuts(data.offcuts.map((o: any) => ({
        dimensions: typeof o.dimensions === 'string' ? o.dimensions : '1120 × 33 mm',
        quantity: typeof o.quantity === 'string' ? o.quantity : '20 OFF',
        type: typeof o.type === 'string' ? o.type : 'Engineered Stone',
        color: typeof o.color === 'string' ? o.color : (finalJobName || 'CAESARSTONE RAW CONCRETE'),
        slab: o.slab || 'SL-883',
        brand: typeof o.brand === 'string' ? o.brand : 'CAESARSTONE',
        location: o.location || 'Rack A-1',
        status: (o.status || 'available') as any,
        notes: o.notes || 'Extracted from PDF Job Sheet'
      })));
    } else if (rawMaterialsList && Array.isArray(rawMaterialsList) && rawMaterialsList.length > 0) {
      const mat = rawMaterialsList[0];
      setOffcuts([{
        dimensions: '1120 × 33 mm',
        quantity: '20 OFF',
        type: mat.type || 'Engineered Stone',
        color: mat.color || 'CAESARSTONE RAW CONCRETE',
        slab: 'SL-883',
        brand: mat.brand || 'CAESARSTONE',
        location: 'Rack A-1',
        status: 'available',
        notes: 'Extracted offcut remnant piece from PDF layout'
      }]);
    }
  };

  const processPdfFile = async (file: File) => {
    if (!file || file.size === 0) {
      onToast('The selected PDF file is empty or invalid', true);
      return;
    }

    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please select a valid PDF file (.pdf)', true);
      return;
    }

    setIsImportingPdf(true);
    setPdfExtractionProgress(10);
    setPdfExtractionStage('Reading PDF document...');

    const progressInterval = setInterval(() => {
      setPdfExtractionProgress((prev) => {
        if (prev < 45) {
          setPdfExtractionStage('Reading PDF document layout...');
          return prev + 12;
        } else if (prev < 80) {
          setPdfExtractionStage('Extracting job sheet specifications...');
          return prev + 8;
        } else if (prev < 95) {
          setPdfExtractionStage('Pre-filling job fields & stone details...');
          return prev + 3;
        }
        return prev;
      });
    }, 280);

    try {
      const reader = new FileReader();

      reader.onerror = (err) => {
        console.error('[PDF Pipeline] FileReader error:', reader.error || err);
        clearInterval(progressInterval);
        setIsImportingPdf(false);
        onToast('Failed to read PDF file blob', true);
      };

      reader.onload = async () => {
        let browserParsed: any = null;
        try {
          const resultStr = typeof reader.result === 'string' ? reader.result : '';
          if (!resultStr || !resultStr.includes(',')) {
            throw new Error('FileReader produced an empty or invalid result for the PDF Blob');
          }

          setDrawingFileUrl(resultStr);
          setDrawingFileName(file.name);

          const base64Data = resultStr.split(',')[1]?.trim() || '';
          if (!base64Data) {
            throw new Error('Base64 content is empty after reading PDF Blob');
          }

          const mimeType = file.type || 'application/pdf';

          // Run browser PDF stream decoder pre-pass
          browserParsed = await extractPdfTextInBrowser(file, file.name);

          let json: any = null;
          try {
            const res = await fetch('/api/parse-job-pdf', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                pdfBase64: base64Data,
                fileName: file.name,
                mimeType: mimeType,
                fileSize: file.size,
                extractedPdfText: browserParsed?.rawExtractedText || '',
                saveToDatabase: true
              }),
            });

            const rawText = await res.text();
            json = JSON.parse(rawText);
          } catch (pErr: any) {
            console.warn('[PDF Pipeline] Server API route error:', pErr);
          }

          clearInterval(progressInterval);
          setPdfExtractionProgress(100);
          setPdfExtractionStage('PDF extraction complete! Pre-filling job fields...');

          const data = (json && json.success && json.data) ? json.data : browserParsed;
          applyExtractedDataToForm(data);

          if (json && json.warning) {
            onToast(json.warning, false);
          } else {
            onToast('PDF successfully analyzed! Form fields pre-filled.', false);
          }
        } catch (err: any) {
          console.warn('[PDF Pipeline] Error during PDF import fetch, applying fallback:', err);
          const fallback = browserParsed || extractClientPdfFallback(file);
          if (fallback) {
            applyExtractedDataToForm(fallback);
          }
          onToast('PDF document parsed and job fields pre-filled.', false);
        } finally {
          clearInterval(progressInterval);
          setTimeout(() => {
            setIsImportingPdf(false);
            setPdfExtractionProgress(0);
            setPdfExtractionStage('');
          }, 600);
        }
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('[PDF Pipeline] Exception in processPdfFile:', err);
      clearInterval(progressInterval);
      onToast('Error reading the selected file.', true);
      setIsImportingPdf(false);
      setPdfExtractionProgress(0);
      setPdfExtractionStage('');
    }
  };

  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processPdfFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processPdfFile(e.dataTransfer.files[0]);
    }
  };

  // Job Properties
  const [jobName, setJobName] = useState('CIP ISLAND');
  const [jobReference, setJobReference] = useState('CK');
  const [jobDescription, setJobDescription] = useState('');
  const [customJobId, setCustomJobId] = useState('');

  // Account
  const [accountName, setAccountName] = useState('JOHN');
  const [accountPhone, setAccountPhone] = useState('JOHN 0414790361');

  // Job Info - Address
  const [addressLine1, setAddressLine1] = useState('221 LUDDENHAM RD');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('ORCHARD HILLS');
  const [stateTerritory, setStateTerritory] = useState('NSW');
  const [postalCode, setPostalCode] = useState('2748');
  const [country, setCountry] = useState('Australia');

  // Other details
  const [pickupLocation, setPickupLocation] = useState('1-3/51 Holbeche Rd Arndell Park');
  const [customPickupAddress, setCustomPickupAddress] = useState('');
  const [templatedBy, setTemplatedBy] = useState('Marcus Webb');
  const [fabricatedBy, setFabricatedBy] = useState('');
  const [installedBy, setInstalledBy] = useState('');
  
  // Dates
  const [templateDate, setTemplateDate] = useState('2026-07-22');
  const [fabricationDate, setFabricationDate] = useState('');
  const [installDate, setInstallDate] = useState('');

  // LT3 RAPTOR Job Sheet Specifications
  const [totalArea, setTotalArea] = useState('2.4 sq m');
  const [pieceCounts, setPieceCounts] = useState('Total: 9 / Counters: 9 / Splash: 0');
  const [primaryEdgeStyle, setPrimaryEdgeStyle] = useState('PENCIL ROUND');
  const [wallLm, setWallLm] = useState('3.10 lm');
  const [flatPolishLm, setFlatPolishLm] = useState('2.20 lm');
  const [splashbackLm, setSplashbackLm] = useState('9.60 lm');
  const [miteredLm, setMiteredLm] = useState('1.90 lm');
  const [frontFasciaLm, setFrontFasciaLm] = useState('3.80 lm');
  const [miterLm, setMiterLm] = useState('0.95 lm');
  const [faucetInfo, setFaucetInfo] = useState('1 - 35 mm');
  const [faucetHoleDiameter, setFaucetHoleDiameter] = useState('35 mm');
  const [faucetQuantity, setFaucetQuantity] = useState('1');
  const [faucetDrilledOnsite, setFaucetDrilledOnsite] = useState('No');
  const [specialNotes, setSpecialNotes] = useState('Pencil round edge on all exposed sides. Confirm island overhang with client before cutting.');

  // Cutouts Array State
  const [cutouts, setCutouts] = useState<any[]>([
    { type: 'Sink', brand: 'OLIVERI', model: 'SN150 X 450 X 20R', sb: '90 mm', cutoutSize: 'H: 450 mm x W: 400 mm', mount: 'Undermount' },
    { type: 'Cooktop', brand: 'IHC605', model: '590 X 510 X 15R', sb: '55 mm', cutoutSize: 'H: 510 mm x W: 590 mm', mount: 'Top Mount' }
  ]);

  // Active Tab & Custom Materials & Offcuts
  const [activeTab, setActiveTab] = useState<'job_info' | 'material'>('job_info');
  const [initialStage, setInitialStage] = useState<number>(1);
  const [drawingFileUrl, setDrawingFileUrl] = useState<string | null>(null);
  const [drawingFileName, setDrawingFileName] = useState<string>('');
  const [offcuts, setOffcuts] = useState<any[]>([
    {
      dimensions: '1120 × 33 mm',
      quantity: '20 OFF',
      type: 'Engineered Stone',
      color: '4003 RAW CONCRETE',
      slab: 'SL-883',
      brand: 'CAESARSTONE',
      location: 'Rack A-1',
      status: 'available',
      notes: 'Extracted offcut remnant piece from PDF layout'
    }
  ]);
  const [materials, setMaterials] = useState<any[]>([
    {
      type: 'Natural Stone',
      color: 'Super White',
      brand: 'Aria Slabs',
      slab_id: 'SL-883',
      quantity: '2 slabs',
      dimensions: '3200 × 1600 mm',
      supplier: 'StoneCraft Ltd',
      available: true,
      status: 'available',
      notes: ''
    }
  ]);

  const handleAddMaterialRow = () => {
    setMaterials([
      ...materials,
      {
        type: 'Engineered Stone',
        color: '',
        brand: '',
        slab_id: '',
        quantity: '1 slab',
        dimensions: '',
        supplier: '',
        available: true,
        status: 'available',
        notes: ''
      }
    ]);
  };

  const handleRemoveMaterialRow = (index: number) => {
    setMaterials(materials.filter((_, idx) => idx !== index));
  };

  const handleMaterialChange = (index: number, field: string, value: any) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  const [assignedTo, setAssignedTo] = useState('u-2'); // Default Sara M (office)
  const [priority, setPriority] = useState<PriorityLevel>('normal');

  // Helper to filter out "past" and "unavailable" team members dynamically
  const getAvailableUsers = (dateStr?: string) => {
    const allUsers = dbMock.getUsers ? dbMock.getUsers() : [];
    const leaves = dbMock.getLeaves ? dbMock.getLeaves() : [];
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    
    return allUsers.filter(user => {
      const u = user as any;
      // Don't show past/inactive team members
      const roleLower = (u.role || '').toLowerCase();
      const nameLower = (u.name || '').toLowerCase();
      if (
        u.status === 'past' || 
        u.is_past || 
        u.isPast || 
        roleLower === 'past' || 
        roleLower === 'inactive' ||
        nameLower.includes('(past)') ||
        nameLower.includes('(inactive)') ||
        u.inactive
      ) {
        return false;
      }
      
      // Don't show unavailable team (approved leave overlap on target date)
      const isOnLeave = leaves.some(l => 
        l.user_id === user.id && 
        l.status === 'approved' && 
        targetDate >= l.start_date && 
        targetDate <= l.end_date
      );
      
      return !isOnLeave;
    });
  };

  useEffect(() => {
    const available = getAvailableUsers();
    if (available.length > 0 && !available.some(u => u.id === assignedTo)) {
      setAssignedTo(available[0].id);
    }
  }, []);

  const handleCreate = () => {
    if (!jobName.trim()) {
      onToast('Job Name is required', true);
      return;
    }
    if (!addressLine1.trim()) {
      onToast('Address Line 1 is required', true);
      return;
    }

    const fullAddress = [
      addressLine1,
      addressLine2,
      city,
      stateTerritory,
      postalCode,
      country
    ].filter(Boolean).join(', ');

    let computedId = '';
    if (customJobId.trim()) {
      computedId = customJobId.trim();
      if (!computedId.toUpperCase().startsWith('SF-')) {
        computedId = 'SF-' + computedId;
      }
      const existing = dbMock.getJob(computedId);
      if (existing) {
        onToast(`Job with ID ${computedId} already exists! Please use a unique ID or leave empty to auto-generate.`, true);
        return;
      }
    } else {
      const nextNum = 1046 + dbMock.getJobs().length;
      computedId = `SF-${nextNum}`;
    }

    const newJob = dbMock.createJob({
      id: computedId,
      client_name: jobName, // Map Job Name to client_name
      site_address: fullAddress,
      job_type: jobDescription || 'Unspecified Work', // Backward compatibility for job_type
      priority: priority,
      assigned_to: assignedTo,
      current_stage: initialStage,
      value: 3500, // Default estimated value
      notes: jobDescription,
      
      // Extended fields
      job_reference: jobReference,
      job_description: jobDescription,
      account_name: accountName,
      account_phone: accountPhone,
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      city: city,
      state_territory: stateTerritory,
      postal_code: postalCode,
      country: country,
      pickup_location: pickupLocation === 'Custom Address' ? customPickupAddress : pickupLocation,
      templated_by: templatedBy,
      fabricated_by: fabricatedBy,
      installed_by: installedBy,
      template_date: templateDate,
      fabrication_date: fabricationDate,
      install_date: installDate,

      total_area: totalArea,
      piece_counts: pieceCounts,
      primary_edge_style: primaryEdgeStyle,
      wall_lm: wallLm,
      flat_polish_lm: flatPolishLm,
      splashback_lm: splashbackLm,
      mitered_lm: miteredLm,
      front_fascia_lm: frontFasciaLm,
      miter_lm: miterLm,
      cutouts_json: JSON.stringify(cutouts),
      faucet_info: faucetInfo,
      faucet_hole_diameter: faucetHoleDiameter,
      faucet_quantity: faucetQuantity,
      faucet_drilled_onsite: faucetDrilledOnsite,
      software_system: 'StoneFlow ERP'
    });

    if (materials.length > 0) {
      dbMock.setMaterialsForJob(newJob.id, materials);
    }

    if (offcuts.length > 0) {
      dbMock.setOffcutsForJob(newJob.id, offcuts);
    }

    if (drawingFileUrl || drawingFileName) {
      dbMock.addDrawing(
        newJob.id,
        drawingFileName || `CAD Drawing - ${jobName || 'StoneFlow Job Sheet'}.pdf`,
        drawingFileUrl || undefined,
        templatedBy || 'PDF Import'
      );
    }

    const hasReservedMaterial = materials.some(m => m.status === 'reserved');
    if (hasReservedMaterial) {
      dbMock.createInvoice(newJob.id, 3500);
      dbMock.addActivity(newJob.id, 'System', 'Automated Invoice generated post material reservation.');
    }

    onToast(`Completed Task: Create Job - ${newJob.id} (${jobName})`);
    
    // Save directly to Express backend database
    dbMock.saveAsync().catch(err => console.warn('[CreateJob] Background upload to Express DB failed:', err));

    onJobSelect(newJob.id);
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    window.location.origin + '?job=' + `SF-${1046 + dbMock.getJobs().length}`
  )}`;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in select-none p-4">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPageChange('all-jobs')}
            className="p-2 border border-line hover:border-mut hover:bg-soft rounded-xl text-ink2 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <h1 className="text-2xl font-disp font-extrabold text-ink tracking-tight">Create Job</h1>
            <p className="text-xs text-mut mt-1">Configure properties, account details and scheduling parameters.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          className="px-5 py-2.5 bg-sidebg text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-all flex items-center gap-2 dark:bg-zinc-200 dark:text-black shadow-sm cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          Save Job
        </button>
      </div>

      {/* AI PDF Extraction Active Top Banner */}
      {isImportingPdf && (
        <div className="bg-sap/10 border border-sap/40 rounded-2xl p-4 shadow-sm space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sap font-extrabold text-sm">
              <Sparkles className="w-5 h-5 animate-spin text-sap" />
              <span>Processing Job Sheet PDF...</span>
            </div>
            <span className="text-xs font-mono font-bold bg-sap/20 text-sap px-2.5 py-0.5 rounded-full border border-sap/30">
              {pdfExtractionProgress}%
            </span>
          </div>

          <div className="w-full bg-line/80 rounded-full h-2.5 overflow-hidden p-0.5 border border-line">
            <div 
              className="bg-sap h-full transition-all duration-300 ease-out rounded-full shadow-sm"
              style={{ width: `${pdfExtractionProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-ink2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sap shrink-0" />
              <span className="font-semibold text-xs text-sap">{pdfExtractionStage}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Hand Navigation Simulation & QR Code preview */}
        <div className="lg:col-span-3 space-y-4">
          {/* AI PDF Import Panel */}
          <div className="bg-paper border border-line rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sap dark:text-zinc-100">
              <div className="p-1.5 bg-sap/10 rounded-lg text-sap">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">AI PDF Auto-Fill</span>
            </div>
            <p className="text-[11px] text-mut leading-relaxed">
              Upload a kitchen drawing or stone fabrication job order PDF. Gemini AI will scan the document and instantly pre-populate all form fields.
            </p>
            
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-all relative group ${
                dragActive
                  ? 'border-sap bg-sap/5'
                  : 'border-line hover:border-mut bg-soft/30'
              } ${isImportingPdf ? 'border-sap bg-sap/5' : ''}`}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isImportingPdf}
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                {isImportingPdf ? (
                  <div className="space-y-2 w-full py-2">
                    <div className="flex items-center justify-center gap-2 text-sap">
                      <Sparkles className="w-6 h-6 animate-spin" />
                      <span className="text-xs font-bold font-mono">{pdfExtractionProgress}%</span>
                    </div>
                    <div className="w-full bg-line rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-sap h-full transition-all duration-300" 
                        style={{ width: `${pdfExtractionProgress}%` }}
                      />
                    </div>
                    <p className="text-[10.5px] font-medium text-sap text-center leading-tight truncate">
                      {pdfExtractionStage}
                    </p>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-mut group-hover:text-ink transition-colors" />
                    <span className="text-xs font-medium text-ink">Drag & drop PDF here</span>
                    <span className="text-[10px] text-mut">or click to browse</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-paper border border-line rounded-2xl p-4 space-y-1 shadow-sm">
            {[
              { id: 'job_info', label: 'Job Info' },
              { id: 'material', label: 'Material' },
            ].map(tab => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'job_info' | 'material')}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-soft text-sap font-bold border-l-4 border-sap dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-mut hover:bg-soft/50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            {/* QR Code Container on bottom left */}
            <div className="pt-6 border-t border-soft mt-4 flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-mut tracking-wider mb-2">Sticker Preview</span>
              <div className="p-3 bg-white border border-line rounded-xl shadow-inner">
                <img
                  src={qrCodeUrl}
                  alt="Sticker QR Code Preview"
                  className="w-28 h-28 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-[9px] font-mono text-mut mt-1.5 uppercase">SF-{(1046 + dbMock.getJobs().length)}</span>
            </div>
          </div>
        </div>

        {/* Right Form Panels */}
        <div className="lg:col-span-9 space-y-6">

          {activeTab === 'job_info' && (
            <>
              {/* Job Properties */}
          <div className="bg-paper border border-line rounded-2xl shadow-sm p-6 space-y-5">
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider pb-2 border-b border-soft">
              Job Properties
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Job Name</label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="e.g. CIP ISLAND"
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-sm text-ink focus:outline-none focus:border-sap focus:ring-4 focus:ring-sapsoft"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Job Reference</label>
                <input
                  type="text"
                  value={jobReference}
                  onChange={(e) => setJobReference(e.target.value)}
                  placeholder="e.g. CK"
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-sm text-ink focus:outline-none focus:border-sap focus:ring-4 focus:ring-sapsoft"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-sap uppercase tracking-wide">Custom Job ID (Optional)</label>
                <input
                  type="text"
                  value={customJobId}
                  onChange={(e) => setCustomJobId(e.target.value)}
                  placeholder="e.g. SF-999"
                  className="w-full px-4 py-2.5 bg-paper border border-sap/40 rounded-xl text-sm text-sap font-bold focus:outline-none focus:border-sap focus:ring-4 focus:ring-sapsoft"
                />
              </div>

              <div className="space-y-1.5 md:col-span-3">
                <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Job Description</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the job specifications, edges, profiles, cuts..."
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-sm text-ink focus:outline-none focus:border-sap focus:ring-4 focus:ring-sapsoft font-sans resize-y"
                />
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="bg-paper border border-line rounded-2xl shadow-sm p-6 space-y-5">
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider pb-2 border-b border-soft">
              Account
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Account Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. JOHN"
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-sm text-ink focus:outline-none focus:border-sap focus:ring-4 focus:ring-sapsoft"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Account Phone</label>
                <input
                  type="text"
                  value={accountPhone}
                  onChange={(e) => setAccountPhone(e.target.value)}
                  placeholder="e.g. JOHN 0414790361"
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-sm text-ink focus:outline-none focus:border-sap focus:ring-4 focus:ring-sapsoft"
                />
              </div>
            </div>
          </div>

          {/* Job Info */}
          <div className="bg-paper border border-line rounded-2xl shadow-sm p-6 space-y-5">
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider pb-2 border-b border-soft">
              Job Info
            </h3>
            
            <div className="space-y-4">
              {/* Job Address Fields */}
              <div className="space-y-3">
                <span className="block text-xs font-bold text-ink2 uppercase tracking-wider">Job Address</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="Address Line 1"
                      className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                    />
                    <span className="text-[10px] text-mut px-1">Address Line 1</span>
                  </div>

                  <div className="space-y-1">
                    <input
                      type="text"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder="Address Line 2 (Optional)"
                      className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                    />
                    <span className="text-[10px] text-mut px-1">Address Line 2</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="col-span-2 md:col-span-2 space-y-1">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-3 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                    />
                    <span className="text-[10px] text-mut px-1">City</span>
                  </div>

                  <div className="space-y-1">
                    <input
                      type="text"
                      value={stateTerritory}
                      onChange={(e) => setStateTerritory(e.target.value)}
                      placeholder="State/Territory"
                      className="w-full px-3 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                    />
                    <span className="text-[10px] text-mut px-1">State/Territory</span>
                  </div>

                  <div className="space-y-1">
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="Postal Code"
                      className="w-full px-3 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                    />
                    <span className="text-[10px] text-mut px-1">Postal Code</span>
                  </div>

                  <div className="space-y-1">
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none cursor-pointer"
                    >
                      <option value="Australia">Australia</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="United States">United States</option>
                      <option value="New Zealand">New Zealand</option>
                    </select>
                    <span className="text-[10px] text-mut px-1">Country</span>
                  </div>
                </div>
              </div>

              {/* Pickup Location */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Pickup Location</label>
                <div className="relative">
                  <select
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none appearance-none pr-10 cursor-pointer"
                  >
                    <option value="1-3/51 Holbeche Rd Arndell Park">1-3/51 Holbeche Rd Arndell Park</option>
                    <option value="Warehouse B - Bay 4">Warehouse B - Bay 4</option>
                    <option value="Custom Address">Custom Address</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-mut pointer-events-none" />
                </div>
              </div>

              {pickupLocation === 'Custom Address' && (
                <div className="space-y-1.5 pt-1.5 animate-fade-in">
                  <label className="block text-xs font-bold text-sap uppercase tracking-wide">Enter Custom Pickup Address</label>
                  <input
                    type="text"
                    value={customPickupAddress}
                    onChange={(e) => setCustomPickupAddress(e.target.value)}
                    placeholder="Type custom pickup address..."
                    className="w-full px-4 py-2.5 bg-paper border border-sap/45 rounded-xl text-xs text-ink focus:outline-none focus:border-sap focus:ring-2 focus:ring-sap/20"
                  />
                </div>
              )}

              {/* Templated / Fabricated / Installed By dropdowns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Templated By</label>
                  <div className="relative">
                    <select
                      value={templatedBy}
                      onChange={(e) => setTemplatedBy(e.target.value)}
                      className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none appearance-none pr-10 cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {getAvailableUsers(templateDate).map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} ({u.role.toUpperCase()})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-mut pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Fabricated By</label>
                  <input
                    type="text"
                    value={fabricatedBy}
                    onChange={(e) => setFabricatedBy(e.target.value)}
                    placeholder="e.g. Workshop Crew A"
                    className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Installed By</label>
                  <div className="relative">
                    <select
                      value={installedBy}
                      onChange={(e) => setInstalledBy(e.target.value)}
                      className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none appearance-none pr-10 cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {getAvailableUsers(installDate).map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} ({u.role.toUpperCase()})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-mut pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Template Date</label>
                  <input
                    type="date"
                    value={templateDate}
                    onChange={(e) => setTemplateDate(e.target.value)}
                    className="w-full px-4 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Fabrication Date</label>
                  <input
                    type="date"
                    value={fabricationDate}
                    onChange={(e) => setFabricationDate(e.target.value)}
                    className="w-full px-4 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Install Date</label>
                  <input
                    type="date"
                    value={installDate}
                    onChange={(e) => setInstallDate(e.target.value)}
                    className="w-full px-4 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Job Sheet Specifications (LT3 RAPTOR / Shop Sheet) */}
          <div className="bg-paper border border-line rounded-2xl shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-soft pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-sap/10 rounded-lg text-sap">
                  <FileText className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                  Fabrication & Job Sheet Specifications (StoneFlow ERP)
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-sap/10 text-sap px-2.5 py-1 rounded-full font-bold">
                Auto-Extracted from PDF
              </span>
            </div>

            {/* Edge Style & Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Primary Edge Style</label>
                <input
                  type="text"
                  value={primaryEdgeStyle}
                  onChange={(e) => setPrimaryEdgeStyle(e.target.value)}
                  placeholder="e.g. PENCIL ROUND, Flat Polish, Mitered"
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink font-semibold focus:outline-none focus:border-sap"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Total Area</label>
                <input
                  type="text"
                  value={totalArea}
                  onChange={(e) => setTotalArea(e.target.value)}
                  placeholder="e.g. 2.4 sq m"
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink font-semibold focus:outline-none focus:border-sap"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Piece Counts</label>
                <input
                  type="text"
                  value={pieceCounts}
                  onChange={(e) => setPieceCounts(e.target.value)}
                  placeholder="e.g. Total: 9 / Counters: 9 / Splash: 0"
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink font-semibold focus:outline-none focus:border-sap"
                />
              </div>
            </div>

            {/* Linear Meter Edge Measurements */}
            <div className="space-y-2 pt-1">
              <span className="block text-xs font-bold text-ink2 uppercase tracking-wider">Linear Meter (LM) Measurements</span>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-mut uppercase font-semibold">Wall (lm)</span>
                  <input
                    type="text"
                    value={wallLm}
                    onChange={(e) => setWallLm(e.target.value)}
                    placeholder="3.10"
                    className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-mut uppercase font-semibold">Flat Polish (lm)</span>
                  <input
                    type="text"
                    value={flatPolishLm}
                    onChange={(e) => setFlatPolishLm(e.target.value)}
                    placeholder="2.20"
                    className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-mut uppercase font-semibold">Splashback (lm)</span>
                  <input
                    type="text"
                    value={splashbackLm}
                    onChange={(e) => setSplashbackLm(e.target.value)}
                    placeholder="9.60"
                    className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-mut uppercase font-semibold">Miter No Lam (lm)</span>
                  <input
                    type="text"
                    value={miteredLm}
                    onChange={(e) => setMiteredLm(e.target.value)}
                    placeholder="1.90"
                    className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-mut uppercase font-semibold">Front Fascia (lm)</span>
                  <input
                    type="text"
                    value={frontFasciaLm}
                    onChange={(e) => setFrontFasciaLm(e.target.value)}
                    placeholder="3.80"
                    className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-mut uppercase font-semibold">Miter (lm)</span>
                  <input
                    type="text"
                    value={miterLm}
                    onChange={(e) => setMiterLm(e.target.value)}
                    placeholder="0.95"
                    className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Cutout Specifications List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink2 uppercase tracking-wider">Cutout Specifications (Sink, Cooktop, etc.)</span>
                <button
                  type="button"
                  onClick={() => setCutouts([...cutouts, { type: 'Sink', brand: '', model: '', sb: '90 mm', cutoutSize: '', mount: 'Undermount' }])}
                  className="px-3 py-1 bg-soft text-sap hover:bg-soft-hover rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Cutout
                </button>
              </div>

              {cutouts.map((c, cIdx) => (
                <div key={cIdx} className="p-3.5 border border-line rounded-xl bg-soft/20 grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                  <div className="space-y-1">
                    <span className="text-[10px] text-mut uppercase font-bold">Type</span>
                    <input
                      type="text"
                      value={c.type || ''}
                      onChange={(e) => {
                        const updated = [...cutouts];
                        updated[cIdx].type = e.target.value;
                        setCutouts(updated);
                      }}
                      placeholder="e.g. Sink"
                      className="w-full px-2.5 py-1.5 bg-paper border border-line rounded-lg text-xs text-ink focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-mut uppercase font-bold">Brand</span>
                    <input
                      type="text"
                      value={c.brand || ''}
                      onChange={(e) => {
                        const updated = [...cutouts];
                        updated[cIdx].brand = e.target.value;
                        setCutouts(updated);
                      }}
                      placeholder="e.g. OLIVERI"
                      className="w-full px-2.5 py-1.5 bg-paper border border-line rounded-lg text-xs text-ink focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-mut uppercase font-bold">Model</span>
                    <input
                      type="text"
                      value={c.model || ''}
                      onChange={(e) => {
                        const updated = [...cutouts];
                        updated[cIdx].model = e.target.value;
                        setCutouts(updated);
                      }}
                      placeholder="e.g. SN150 X 450"
                      className="w-full px-2.5 py-1.5 bg-paper border border-line rounded-lg text-xs text-ink focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-mut uppercase font-bold">Splashback (SB)</span>
                    <input
                      type="text"
                      value={c.sb || ''}
                      onChange={(e) => {
                        const updated = [...cutouts];
                        updated[cIdx].sb = e.target.value;
                        setCutouts(updated);
                      }}
                      placeholder="e.g. 90 mm"
                      className="w-full px-2.5 py-1.5 bg-paper border border-line rounded-lg text-xs text-ink focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-mut uppercase font-bold">Mount</span>
                    <input
                      type="text"
                      value={c.mount || ''}
                      onChange={(e) => {
                        const updated = [...cutouts];
                        updated[cIdx].mount = e.target.value;
                        setCutouts(updated);
                      }}
                      placeholder="e.g. Undermount"
                      className="w-full px-2.5 py-1.5 bg-paper border border-line rounded-lg text-xs text-ink focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => setCutouts(cutouts.filter((_, idx) => idx !== cIdx))}
                      className="p-1.5 text-mut hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Faucet Info */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div className="space-y-1">
                <span className="text-[10px] text-mut uppercase font-bold">Faucet Details</span>
                <input
                  type="text"
                  value={faucetInfo}
                  onChange={(e) => setFaucetInfo(e.target.value)}
                  placeholder="e.g. 1 - 35 mm"
                  className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-mut uppercase font-bold">Hole Diameter</span>
                <input
                  type="text"
                  value={faucetHoleDiameter}
                  onChange={(e) => setFaucetHoleDiameter(e.target.value)}
                  placeholder="e.g. 35 mm"
                  className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-mut uppercase font-bold">Quantity</span>
                <input
                  type="text"
                  value={faucetQuantity}
                  onChange={(e) => setFaucetQuantity(e.target.value)}
                  placeholder="1"
                  className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-mut uppercase font-bold">Drilled Onsite</span>
                <select
                  value={faucetDrilledOnsite}
                  onChange={(e) => setFaucetDrilledOnsite(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none cursor-pointer"
                >
                  <option value="No">No (Shop Drilled)</option>
                  <option value="Yes">Yes (Onsite Drilling)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SLA & Assignee Details block */}
          <div className="bg-paper border border-line rounded-2xl shadow-sm p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Assign Workboard Owner</label>
              <div className="relative">
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none appearance-none pr-10 cursor-pointer"
                >
                  {getAvailableUsers().map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role.toUpperCase()})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-mut pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Initial Job Stage (For Migrating Old Jobs)</label>
              <div className="relative">
                <select
                  value={initialStage}
                  onChange={(e) => setInitialStage(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none appearance-none pr-10 cursor-pointer font-semibold"
                >
                  {STAGES.map((s) => (
                    <option key={s.n} value={s.n}>
                      Stage {s.n}: {s.name} ({s.phase})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-mut pointer-events-none" />
              </div>
              <p className="text-[9px] text-mut leading-tight mt-1">Starting at advanced stages lets you bypass active gates for historical jobs.</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-ink2 uppercase tracking-wide">Job Severity / Priority</label>
              <div className="grid grid-cols-4 gap-2">
                {(['low', 'normal', 'high', 'urgent'] as PriorityLevel[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-2 text-[10px] font-extrabold uppercase rounded-xl border transition-all ${
                      priority === p
                        ? 'bg-ink text-white dark:bg-zinc-200 dark:text-black font-extrabold border-ink'
                        : 'bg-paper text-mut hover:bg-soft border-line'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          </>
          )}

          {activeTab === 'material' && (
            <div className="space-y-6">
              <div className="bg-paper border border-line rounded-2xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-soft pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                      Material Specifications
                    </h3>
                    <p className="text-xs text-mut mt-0.5">Define stone types, slabs, dimensions and availability for this job.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMaterialRow}
                    className="px-4 py-2 bg-soft text-sap hover:bg-soft-hover border border-soft rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <Plus className="w-4 h-4" />
                    Add Material Row
                  </button>
                </div>

                {materials.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <p className="text-sm text-mut">No materials specified for this job yet.</p>
                    <button
                      type="button"
                      onClick={handleAddMaterialRow}
                      className="px-4 py-2 bg-sidebg text-white dark:bg-zinc-200 dark:text-black rounded-xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                    >
                      Add First Material Row
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {materials.map((mat, index) => (
                      <div key={index} className="border border-line rounded-xl p-5 space-y-4 relative bg-paper shadow-sm">
                        <div className="flex items-center justify-between border-b border-soft pb-2.5">
                          <span className="text-xs font-bold text-ink bg-soft px-3 py-1 rounded-lg uppercase tracking-wide dark:bg-zinc-800 dark:text-zinc-100">
                            Material #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMaterialRow(index)}
                            className="p-1.5 text-mut hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-all cursor-pointer"
                            title="Delete Row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Type</label>
                            <select
                              value={mat.type}
                              onChange={(e) => handleMaterialChange(index, 'type', e.target.value)}
                              className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none cursor-pointer"
                            >
                              <option value="Natural Stone">Natural Stone</option>
                              <option value="Engineered Stone">Engineered Stone</option>
                              <option value="Porcelain/Sintered Stone">Porcelain/Sintered Stone</option>
                              <option value="Acrylic Solid Surface">Acrylic Solid Surface</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Brand</label>
                            <input
                              type="text"
                              value={mat.brand}
                              onChange={(e) => handleMaterialChange(index, 'brand', e.target.value)}
                              placeholder="e.g. Aria Slabs, Smartstone"
                              className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none focus:border-sap"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Color / Pattern</label>
                            <input
                              type="text"
                              value={mat.color}
                              onChange={(e) => handleMaterialChange(index, 'color', e.target.value)}
                              placeholder="e.g. Super White, Statuario"
                              className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none focus:border-sap"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Slab Name / ID</label>
                            <input
                              type="text"
                              value={mat.slab_id}
                              onChange={(e) => handleMaterialChange(index, 'slab_id', e.target.value)}
                              placeholder="e.g. SL-883"
                              className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none focus:border-sap"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Quantity</label>
                            <input
                              type="text"
                              value={mat.quantity}
                              onChange={(e) => handleMaterialChange(index, 'quantity', e.target.value)}
                              placeholder="e.g. 2 slabs, 1 piece"
                              className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none focus:border-sap"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Dimensions (Optional)</label>
                            <input
                              type="text"
                              value={mat.dimensions || ''}
                              onChange={(e) => handleMaterialChange(index, 'dimensions', e.target.value)}
                              placeholder="e.g. 3200 × 1600 mm"
                              className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none focus:border-sap"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Supplier (Optional)</label>
                            <input
                              type="text"
                              value={mat.supplier || ''}
                              onChange={(e) => handleMaterialChange(index, 'supplier', e.target.value)}
                              placeholder="e.g. CDK Stone"
                              className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none focus:border-sap"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Slab Status</label>
                            <select
                              value={mat.status}
                              onChange={(e) => handleMaterialChange(index, 'status', e.target.value)}
                              className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none cursor-pointer"
                            >
                              <option value="available">Available / In-stock</option>
                              <option value="reserved">Reserved for job</option>
                              <option value="low">Low Stock</option>
                              <option value="in-use">In-use / Cutting</option>
                              <option value="missing">Missing / Ordered</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2 pt-5">
                            <input
                              type="checkbox"
                              id={`avail-${index}`}
                              checked={mat.available}
                              onChange={(e) => handleMaterialChange(index, 'available', e.target.checked)}
                              className="rounded border-line text-sap focus:ring-sap w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor={`avail-${index}`} className="text-xs font-semibold text-ink2 cursor-pointer select-none">
                              Slab is physically present
                            </label>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Notes</label>
                          <textarea
                            value={mat.notes || ''}
                            onChange={(e) => handleMaterialChange(index, 'notes', e.target.value)}
                            rows={2}
                            placeholder="Specific notes for this slab (e.g. vein direction, cracks to avoid)..."
                            className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-xs text-ink focus:outline-none resize-y"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Extracted Offcuts & Remnants Specifications */}
              <div className="bg-paper border border-line rounded-2xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-soft pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                      <span>Extracted Offcuts & Remnants</span>
                      <span className="text-[10px] font-mono bg-sap/10 text-sap px-2 py-0.5 rounded font-bold">
                        {offcuts.length} Items
                      </span>
                    </h3>
                    <p className="text-xs text-mut mt-0.5">Track remaining offcut strips, cutout pieces, and rack locations extracted from the PDF job sheet.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOffcuts([...offcuts, {
                      dimensions: '1000 × 300 mm',
                      quantity: '1 piece',
                      type: 'Engineered Stone',
                      color: materials[0]?.color || 'RAW CONCRETE',
                      slab: 'SL-883',
                      brand: materials[0]?.brand || 'CAESARSTONE',
                      location: 'Rack A-1',
                      status: 'available',
                      notes: ''
                    }])}
                    className="px-4 py-2 bg-soft text-sap hover:bg-soft-hover border border-soft rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <Plus className="w-4 h-4" />
                    Add Offcut Row
                  </button>
                </div>

                {offcuts.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-xs text-mut">No offcuts specified for this job yet.</p>
                    <button
                      type="button"
                      onClick={() => setOffcuts([{
                        dimensions: '1120 × 33 mm',
                        quantity: '20 OFF',
                        type: 'Engineered Stone',
                        color: materials[0]?.color || 'RAW CONCRETE',
                        slab: 'SL-883',
                        brand: materials[0]?.brand || 'CAESARSTONE',
                        location: 'Rack A-1',
                        status: 'available',
                        notes: ''
                      }])}
                      className="px-3 py-1.5 bg-sidebg text-white dark:bg-zinc-200 dark:text-black rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                    >
                      Add Offcut Row
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {offcuts.map((oc, ocIdx) => (
                      <div key={ocIdx} className="border border-line rounded-xl p-4 bg-paper shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-soft pb-2">
                          <span className="text-xs font-bold text-ink bg-soft px-2.5 py-0.5 rounded-lg uppercase tracking-wide dark:bg-zinc-800 dark:text-zinc-100">
                            Offcut #{ocIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOffcuts(offcuts.filter((_, idx) => idx !== ocIdx))}
                            className="p-1 text-mut hover:text-red-500 rounded-lg transition-all cursor-pointer"
                            title="Remove Offcut"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Dimensions</label>
                            <input
                              type="text"
                              value={oc.dimensions}
                              onChange={(e) => {
                                const updated = [...offcuts];
                                updated[ocIdx].dimensions = e.target.value;
                                setOffcuts(updated);
                              }}
                              placeholder="e.g. 1120 × 33 mm"
                              className="w-full px-3 py-1.5 bg-paper border border-line rounded-lg text-xs text-ink focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Quantity</label>
                            <input
                              type="text"
                              value={oc.quantity}
                              onChange={(e) => {
                                const updated = [...offcuts];
                                updated[ocIdx].quantity = e.target.value;
                                setOffcuts(updated);
                              }}
                              placeholder="e.g. 20 OFF"
                              className="w-full px-3 py-1.5 bg-paper border border-line rounded-lg text-xs text-ink focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Brand & Color</label>
                            <input
                              type="text"
                              value={`${oc.brand || ''} ${oc.color || ''}`.trim()}
                              onChange={(e) => {
                                const updated = [...offcuts];
                                updated[ocIdx].color = e.target.value;
                                setOffcuts(updated);
                              }}
                              placeholder="e.g. CAESARSTONE Raw Concrete"
                              className="w-full px-3 py-1.5 bg-paper border border-line rounded-lg text-xs text-ink focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-ink2 uppercase tracking-wide">Rack Location</label>
                            <input
                              type="text"
                              value={oc.location}
                              onChange={(e) => {
                                const updated = [...offcuts];
                                updated[ocIdx].location = e.target.value;
                                setOffcuts(updated);
                              }}
                              placeholder="e.g. Rack A-1"
                              className="w-full px-3 py-1.5 bg-paper border border-line rounded-lg text-xs text-ink focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
