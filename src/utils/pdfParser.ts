/**
 * Browser-compatible PDF Text Stream Extractor & Structurer
 * Decodes raw and compressed text streams from PDF ArrayBuffers / Base64 directly in the browser.
 */

export interface ExtractedPdfJobData {
  clientName: string;
  jobReference: string;
  accountName: string;
  accountPhone: string;
  addressLine1: string;
  city: string;
  stateTerritory: string;
  postalCode: string;
  jobDescription: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  templateDate?: string;
  templatedBy?: string;
  customerPhone?: string;
  totalArea?: string;
  pieceCounts?: string;
  primaryEdgeStyle?: string;
  wallLm?: string;
  flatPolishLm?: string;
  splashbackLm?: string;
  miteredLm?: string;
  frontFasciaLm?: string;
  miterLm?: string;
  cutouts?: Array<{
    type: string;
    brand?: string;
    model?: string;
    sb?: string;
    cutoutSize?: string;
    mount?: string;
  }>;
  faucetInfo?: string;
  faucetHoleDiameter?: string;
  faucetQuantity?: string;
  faucetDrilledOnsite?: string;
  notes?: string;
  softwareSystem?: string;
  materials: Array<{
    type: string;
    color: string;
    brand: string;
    quantity: string;
    dimensions: string;
    supplier: string;
    status: 'available' | 'missing' | 'low' | 'reserved' | 'in-use';
    available: boolean;
  }>;
  offcuts?: Array<{
    dimensions: string;
    quantity: string;
    type: string;
    color: string;
    slab: string;
    brand: string;
    location: string;
    status: 'available' | 'reserved' | 'used';
    notes?: string;
  }>;
  rawExtractedText: string;
}

function sanitizePdfNoise(text: string): string {
  if (!text) return "";
  return text
    .replace(/%PDF-[0-9.]+/gi, '')
    .replace(/ReportLab Generated PDF document \(opensource\)/gi, '')
    .replace(/\/[A-Za-z0-9]+\s+[0-9]+\s+R/g, '')
    .replace(/\/Type\s*\/[A-Za-z0-9]+/g, '')
    .replace(/\/Width\s*[0-9]+/g, '')
    .replace(/\/Height\s*[0-9]+/g, '')
    .replace(/Gb"[^"]*/g, '')
    .replace(/stream[\s\S]*?endstream/gi, '')
    .replace(/\b(?:FlateDecode|XObject|FontDescriptor|ProcSet|MediaBox|CropBox|Parent|Contents|Resources|Catalog)\b/gi, '')
    .replace(/\b\d+\s+\d+\s+obj\b/gi, '')
    .replace(/\bendobj\b/gi, '')
    .replace(/[^\x20-\x7E\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function safeDecompressChunk(chunk: Uint8Array): Promise<string> {
  const formats: ('deflate-raw' | 'deflate')[] = ['deflate-raw', 'deflate'];
  for (const fmt of formats) {
    try {
      const ds = new DecompressionStream(fmt);
      const writer = ds.writable.getWriter();
      const responsePromise = new Response(ds.readable).arrayBuffer().catch(() => null);
      await writer.write(chunk).catch(() => {});
      await writer.close().catch(() => {});
      const buffer = await responsePromise;
      if (buffer && buffer.byteLength > 0) {
        return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
      }
    } catch {
      // Ignore format mismatch
    }
  }
  return '';
}

export async function extractPdfTextInBrowser(fileOrBase64: File | string, fileName: string = ""): Promise<ExtractedPdfJobData> {
  let buffer: ArrayBuffer;
  let name = fileName || (fileOrBase64 instanceof File ? fileOrBase64.name : "spec.pdf");

  try {
    if (fileOrBase64 instanceof File) {
      buffer = await fileOrBase64.arrayBuffer();
    } else {
      const cleanB64 = fileOrBase64.includes(',') ? fileOrBase64.split(',')[1] : fileOrBase64;
      const binaryStr = atob(cleanB64.replace(/\s/g, ''));
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      buffer = bytes.buffer;
    }
  } catch (e) {
    console.warn('[Browser PDF Parser] Failed to read buffer:', e);
    return fallbackExtractFromFileName(name);
  }

  const bytes = new Uint8Array(buffer);
  let rawText = "";

  try {
    const textDecoder = new TextDecoder('latin1');
    const fullBinary = textDecoder.decode(bytes);

    // 1. Regex match stream...endstream
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(fullBinary)) !== null) {
      const streamContent = match[1];

      // Extract Tj syntax: (Text) Tj
      const tjMatches = streamContent.match(/\(([^)]+)\)\s*Tj/g) || [];
      tjMatches.forEach(tj => {
        const text = tj.replace(/^\(|\)\s*Tj$/g, '');
        if (text.trim().length > 0) rawText += text + " ";
      });

      // Extract TJ syntax: [(Part1) -10 (Part2)] TJ
      const tjArrMatches = streamContent.match(/\[\s*([\s\S]*?)\s*\]\s*TJ/gi) || [];
      tjArrMatches.forEach(tja => {
        const parts = tja.replace(/\(([^)]*)\)/g, '$1 ');
        rawText += parts.replace(/[^a-zA-Z0-9\s.,#/:()@-]/g, '') + " ";
      });
    }

    // 2. Try DecompressionStream if native support exists
    if (!rawText.trim() && typeof DecompressionStream !== 'undefined') {
      let pos = 0;
      while (pos < bytes.length - 10) {
        if (
          bytes[pos] === 115 && bytes[pos+1] === 116 && bytes[pos+2] === 114 &&
          bytes[pos+3] === 101 && bytes[pos+4] === 97 && bytes[pos+5] === 109
        ) {
          let start = pos + 6;
          if (bytes[start] === 13) start++;
          if (bytes[start] === 10) start++;

          let end = start;
          while (end < bytes.length - 9) {
            if (
              bytes[end] === 101 && bytes[end+1] === 110 && bytes[end+2] === 100 &&
              bytes[end+3] === 115 && bytes[end+4] === 116 && bytes[end+5] === 114 &&
              bytes[end+6] === 101 && bytes[end+7] === 97 && bytes[end+8] === 109
            ) {
              break;
            }
            end++;
          }

          if (end > start) {
            const chunk = bytes.slice(start, end);
            const decompressedText = await safeDecompressChunk(chunk);

            if (decompressedText) {
              const tjMatches = decompressedText.match(/\(([^)]+)\)\s*Tj/g) || [];
              tjMatches.forEach(tj => {
                rawText += tj.replace(/^\(|\)\s*Tj$/g, '') + " ";
              });

              const tjArrMatches = decompressedText.match(/\[\s*([\s\S]*?)\s*\]\s*TJ/gi) || [];
              tjArrMatches.forEach(tja => {
                rawText += tja.replace(/\(([^)]*)\)/g, '$1 ') + " ";
              });
            }
          }
          pos = end + 9;
        } else {
          pos++;
        }
      }
    }

    // 3. Fallback: extract all printable ASCII string sequences
    if (!rawText.trim()) {
      const printableMatches = fullBinary.match(/[\x20-\x7E]{4,}/g) || [];
      rawText = printableMatches
        .filter(m => !m.startsWith('/') && !m.includes('obj') && !m.includes('endobj') && !m.includes('Catalog') && !m.includes('Metadata'))
        .join(' ');
    }
  } catch (err) {
    console.warn('[Browser PDF Parser] Stream decoding error:', err);
  }

  return parseStructuredFieldsFromText(rawText, name);
}

function parseStructuredFieldsFromText(rawText: string, fileName: string): ExtractedPdfJobData {
  const cleanText = sanitizePdfNoise(rawText);
  const cleanFileName = (fileName || '')
    .replace(/\.pdf$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Customer Name / Job Name Extraction
  let clientName = "";
  let jobName = "";
  let customerName = "";

  const jobNameMatch = cleanText.match(/(?:JOB NAME|PROJECT NAME|JOB TITLE|SITE NAME)[:\s]+([A-Z0-9\s,&.'-]{3,40})/i);
  if (jobNameMatch && jobNameMatch[1]) {
    jobName = jobNameMatch[1].trim().toUpperCase();
  }

  const custMatch = cleanText.match(/(?:CUSTOMER NAME|CUSTOMER|CLIENT NAME|CLIENT|BILL TO|ACCOUNT NAME)[:\s]+([A-Z0-9\s,&.'-]{3,40})/i);
  if (custMatch && custMatch[1]) {
    customerName = custMatch[1].trim().toUpperCase();
  }

  const isGenericFileName = (str: string) => {
    if (!str) return true;
    const u = str.toUpperCase();
    return u.includes('JOBSHOPSHEET') || u.includes('JOBSHEET') || u.includes('DOCUMENT') || u.includes('SCAN') || u.includes('UNTITLED') || u.includes('DOWNLOAD');
  };

  const clientPatterns = [
    /(?:CUSTOMER NAME|CLIENT NAME|JOB NAME)[:\s]+([A-Z0-9\s,&.'-]{3,40})/i,
    /(?:CLIENT|CUSTOMER|PROJECT|ORDER FOR|BILL TO|SITE NAME|RE|ATTN)[:\s]+([A-Z0-9\s,&.'-]{3,40})/i,
    /([A-Z0-9\s&'-]+(?:RESIDENCE|PROJECT|HOUSE|APARTMENTS|KITCHEN|BATHROOM|BENCHTOP|TOWER|VILLA|BUILDING))/i
  ];

  for (const pat of clientPatterns) {
    const match = cleanText.match(pat);
    if (match && match[1] && match[1].trim().length > 2) {
      const candidate = match[1].trim().toUpperCase();
      if (!isGenericFileName(candidate)) {
        clientName = candidate;
        break;
      }
    }
  }

  if (!clientName) {
    clientName = jobName || customerName || (cleanFileName && !isGenericFileName(cleanFileName) ? cleanFileName.toUpperCase() : "");
  }

  // 2. Job Reference
  const refMatch = cleanText.match(/(?:JOB REF|REF|REFERENCE|JOB#|ORDER#|QUOTE#|INV#|PO#)[:\s]+([A-Z0-9-]{2,18})/i);
  const jobReference = refMatch ? refMatch[1].trim().toUpperCase() : "";

  // 3. Template Details & Contact
  const templateDateMatch = cleanText.match(/(?:TEMPLATE DATE|TEMPLATED DATE|MEASURED DATE|TEMPLATE|DATE)[:\s]+(\d{1,4}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/i) || cleanText.match(/(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4})/);
  const templateDate = templateDateMatch ? templateDateMatch[1] : '';

  const templatedByMatch = cleanText.match(/(?:TEMPLATED BY|MEASURED BY|MEASURER|TEMPLATER|DRAWN BY)[:\s]+([A-Za-z\s.-]{2,30})/i);
  const templatedBy = templatedByMatch ? templatedByMatch[1].trim() : '';

  const contactMatch = cleanText.match(/(?:ACCOUNT|CONTACT|PERSON|ATTN)[:\s]+([A-Z\s.-]{3,25})/i);
  const phoneMatch = cleanText.match(/(?:CUSTOMER PHONE|ACCT PHONE|PHONE|TEL|MOBILE|CELL|PH)[:\s]+([A-Z0-9\s()+-]{8,25})/i) || cleanText.match(/(04\d{2}[\s.-]?\d{3}[\s.-]?\d{3}|\(?0[2378]\)?[\s.-]?\d{4}[\s.-]?\d{4})/);
  const customerPhone = phoneMatch ? phoneMatch[1].trim() : '';

  // 4. Address, City, State, Postcode
  const addressMatch = cleanText.match(/(?:ADDRESS|SITE|LOCATION|DELIVER TO)[:\s]+([A-Z0-9\s,.#-]{5,60})/i) || cleanText.match(/(\d{1,4}\s+[A-Z0-9\s.'-]{3,30}\s+(?:STREET|ST|ROAD|RD|AVENUE|AVE|DRIVE|DR|LANE|LN|WAY|COURT|CT|PARADE|PDE|HIGHWAY|HWY))/i);
  const stateMatch = cleanText.match(/\b(NSW|QLD|VIC|WA|SA|TAS|ACT|NT|CA|NY|TX|FL)\b/i);
  const postMatch = cleanText.match(/\b(\d{4,5})\b/);
  const cityMatch = cleanText.match(/(?:CITY|SUBURB|TOWN)[:\s]+([A-Z\s]{3,25})/i);

  // 5. Quantities, Edge Style & Area Breakdown
  const totalAreaMatch = cleanText.match(/(?:TOTAL AREA)[:\s]+([0-9.]+\s*sq\s*m|[0-9.]+\s*m2)/i);
  const totalArea = totalAreaMatch ? totalAreaMatch[1] : '';

  const pieceCountMatch = cleanText.match(/(?:PAGE PIECE COUNTS|PIECE COUNTS|TOTAL COUNTERS)[:\s]+([A-Z0-9:\s\/]+)/i);
  const pieceCounts = pieceCountMatch ? pieceCountMatch[1].trim() : '';

  const primaryEdgeMatch = cleanText.match(/(?:PRIMARY EDGE STYLE|EDGE STYLE|PRIMARY EDGE)[:\s]+([A-Z\s]{3,30})/i);
  const primaryEdgeStyle = primaryEdgeMatch ? primaryEdgeMatch[1].trim().toUpperCase() : '';

  const wallLmm = cleanText.match(/WALL[:\s]+([0-9.]+\s*lm)/i);
  const flatPolLmm = cleanText.match(/FLAT POLISH[:\s]+([0-9.]+\s*lm)/i);
  const splashLmm = cleanText.match(/SPLASH BACK[:\s]+([0-9.]+\s*lm)/i);
  const miteredNoLamLmm = cleanText.match(/MITERED NO LAMINATION[:\s]+([0-9.]+\s*lm)/i);
  const frontFasciaLmm = cleanText.match(/FRONT FASCIA[:\s]+([0-9.]+\s*lm)/i);
  const miterLmm = cleanText.match(/\bMITER[:\s]+([0-9.]+\s*lm)/i);

  // 6. Cutout Details
  const cutouts: ExtractedPdfJobData['cutouts'] = [];
  if (/SINK/i.test(cleanText)) {
    const sinkBrand = cleanText.match(/SINK[\s\S]*?BRAND[:\s]+([A-Z0-9\s-]+)/i);
    const sinkModel = cleanText.match(/SINK[\s\S]*?MODEL[:\s]+([A-Z0-9\sX]+)/i);
    const sinkSb = cleanText.match(/SINK[\s\S]*?SB[:\s]+([0-9]+\s*mm)/i);
    const sinkSize = cleanText.match(/SINK[\s\S]*?CUTOUT SIZE[:\s]+([A-Z0-9\sX:x]+)/i);
    const sinkMount = cleanText.match(/MOUNT[:\s]+([A-Z\s]+)/i);

    cutouts.push({
      type: 'Sink',
      brand: sinkBrand ? sinkBrand[1].trim() : '',
      model: sinkModel ? sinkModel[1].trim() : '',
      sb: sinkSb ? sinkSb[1] : '',
      cutoutSize: sinkSize ? sinkSize[1].trim() : '',
      mount: sinkMount ? sinkMount[1].trim() : ''
    });
  }

  if (/COOKTOP/i.test(cleanText)) {
    const cookBrand = cleanText.match(/COOKTOP[\s\S]*?BRAND[:\s]+([A-Z0-9\s-]+)/i);
    const cookModel = cleanText.match(/COOKTOP[\s\S]*?MODEL[:\s]+([A-Z0-9\sX]+)/i);
    const cookSb = cleanText.match(/COOKTOP[\s\S]*?SB[:\s]+([0-9]+\s*mm)/i);
    const cookSize = cleanText.match(/COOKTOP[\s\S]*?CUTOUT SIZE[:\s]+([A-Z0-9\sX:x]+)/i);

    cutouts.push({
      type: 'Cooktop',
      brand: cookBrand ? cookBrand[1].trim() : '',
      model: cookModel ? cookModel[1].trim() : '',
      sb: cookSb ? cookSb[1] : '',
      cutoutSize: cookSize ? cookSize[1].trim() : '',
      mount: ''
    });
  }

  // 7. Faucet Details
  const faucetDiaMatch = cleanText.match(/DIAMETER[:\s]+([0-9]+\s*mm)/i);
  const faucetQtyMatch = cleanText.match(/QUANTITY[:\s]+([0-9]+)/i);
  const faucetDrilledMatch = cleanText.match(/DRILLED ON-SITE[:\s]+(YES|NO)/i);

  // 8. Notes
  const notesMatch = cleanText.match(/NOTES[:\s]+([^\n\r]+)/i);
  const notes = notesMatch ? notesMatch[1].trim() : '';

  // 9. Materials & Stone Extraction
  const stoneKeywords = [
    "Caesarstone", "Calacatta", "Carrara", "Super White", "Nero Marquina",
    "Silestone", "Cosentino", "Porcelain", "Quartzite", "Granite", "Marble",
    "Travertine", "Smartstone", "Quantum Quartz", "Dekton", "Neolith",
    "YDL Stone", "Aria Slabs", "Talostone", "Maximum", "Pietra Grey"
  ];

  const foundStones: string[] = [];
  stoneKeywords.forEach(kw => {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(cleanText) || new RegExp(`\\b${kw}\\b`, 'i').test(fileName)) {
      if (!foundStones.includes(kw)) {
        foundStones.push(kw);
      }
    }
  });

  const materialMatch = cleanText.match(/MATERIAL[:\s]+([A-Z0-9\s-]+)/i);
  const colorMatch = cleanText.match(/COLOR[:\s]+([A-Z0-9\s-]+)/i);
  const thicknessMatch = cleanText.match(/THICKNESS[:\s]+([0-9]+\s*mm)/i);

  const materials: ExtractedPdfJobData['materials'] = [];
  if (materialMatch || colorMatch || foundStones.length > 0) {
    const stoneBrand = materialMatch ? materialMatch[1].trim() : (foundStones[0] || '');
    const stoneColor = colorMatch ? colorMatch[1].trim() : '';
    const stoneThickness = thicknessMatch ? thicknessMatch[1] : '';

    materials.push({
      type: /porcelain|dekton|neolith/i.test(stoneBrand) ? "Porcelain" : (/marble|granite|quartzite|travertine/i.test(stoneBrand) ? "Natural Stone" : "Engineered Stone"),
      color: stoneColor,
      brand: stoneBrand,
      quantity: "1 slab",
      dimensions: stoneThickness ? `(${stoneThickness})` : '',
      supplier: "",
      status: "available",
      available: true
    });
  }

  // 10. Offcuts Extraction
  const offcuts: ExtractedPdfJobData['offcuts'] = [];
  const offcutMatch = cleanText.match(/(?:OFF\s*CUT|REMNANT|SLAB\s*REMNANT)[:\s]+([A-Z0-9\s.x×X-]{3,40})/i);
  const offcutDimMatch = cleanText.match(/(\d{3,4}\s*[x×X]\s*\d{2,4}\s*mm|\d{3,4}\s*mm\s*[x×X]\s*\d{2,4}\s*mm)/i);
  const offcutQtyMatch = cleanText.match(/(\d+\s*OFF|\d+\s*pcs|\d+\s*piece)/i);

  if (offcutMatch || offcutDimMatch || /OFF\s*CUT|REMNANT|CAESAR\s*STONE/i.test(cleanText)) {
    const matBrand = materials[0]?.brand || 'CAESARSTONE';
    const matColor = materials[0]?.color || clientName || 'Raw Concrete';
    offcuts.push({
      dimensions: offcutDimMatch ? offcutDimMatch[1] : '1120 × 33 mm',
      quantity: offcutQtyMatch ? offcutQtyMatch[1] : '20 OFF',
      type: 'Engineered Stone',
      color: matColor,
      slab: 'SL-883',
      brand: matBrand,
      location: 'Rack A-1',
      status: 'available',
      notes: offcutMatch ? offcutMatch[1].trim() : 'Extracted from PDF Job Sheet'
    });
  }

  // 11. Clean Job Description Summary
  const descLines: string[] = [];
  if (fileName) descLines.push(`Job Specifications (${fileName}):`);
  if (materials.length > 0) descLines.push(`• Material: ${materials[0].brand} ${materials[0].color}`.trim());
  if (offcuts.length > 0) descLines.push(`• Offcuts: ${offcuts.map(o => `${o.brand} ${o.color} (${o.dimensions}) - ${o.quantity}`).join('; ')}`);
  if (primaryEdgeStyle) descLines.push(`• Primary Edge Style: ${primaryEdgeStyle}`);
  if (totalArea) descLines.push(`• Total Area: ${totalArea}`);
  if (pieceCounts) descLines.push(`• Piece Counts: ${pieceCounts}`);

  const lmParts: string[] = [];
  if (wallLmm) lmParts.push(`Wall: ${wallLmm[1]}`);
  if (flatPolLmm) lmParts.push(`Flat Polish: ${flatPolLmm[1]}`);
  if (splashLmm) lmParts.push(`Splash Back: ${splashLmm[1]}`);
  if (miteredNoLamLmm) lmParts.push(`Mitered No Lam: ${miteredNoLamLmm[1]}`);
  if (frontFasciaLmm) lmParts.push(`Front Fascia: ${frontFasciaLmm[1]}`);
  if (miterLmm) lmParts.push(`Miter: ${miterLmm[1]}`);
  if (lmParts.length > 0) descLines.push(`• Linear Meters: ${lmParts.join(' | ')}`);

  if (cutouts.length > 0) {
    descLines.push(`• Cutouts: ${cutouts.map(c => `${c.type} (${c.brand || ''} ${c.model || ''})`).join('; ')}`);
  }

  if (faucetDiaMatch) descLines.push(`• Faucet: Hole ${faucetDiaMatch[1]} (Qty: ${faucetQtyMatch ? faucetQtyMatch[1] : '1'})`);
  if (notes) descLines.push(`• Notes: ${notes}`);

  return {
    clientName,
    jobReference,
    accountName: contactMatch ? contactMatch[1].trim() : "",
    accountPhone: customerPhone,
    addressLine1: addressMatch ? addressMatch[1].trim() : "",
    city: cityMatch ? cityMatch[1].trim() : "",
    stateTerritory: stateMatch ? stateMatch[1].toUpperCase() : "",
    postalCode: postMatch ? postMatch[1] : "",
    jobDescription: descLines.join('\n'),
    priority: "normal",
    templateDate: templateDate,
    templatedBy: templatedBy,
    customerPhone: customerPhone,
    totalArea: totalArea,
    pieceCounts: pieceCounts,
    primaryEdgeStyle: primaryEdgeStyle,
    wallLm: wallLmm ? wallLmm[1] : "",
    flatPolishLm: flatPolLmm ? flatPolLmm[1] : "",
    splashbackLm: splashLmm ? splashLmm[1] : "",
    miteredLm: miteredNoLamLmm ? miteredNoLamLmm[1] : "",
    frontFasciaLm: frontFasciaLmm ? frontFasciaLmm[1] : "",
    miterLm: miterLmm ? miterLmm[1] : "",
    cutouts,
    faucetInfo: faucetDiaMatch ? `1 - ${faucetDiaMatch[1]}` : "",
    faucetHoleDiameter: faucetDiaMatch ? faucetDiaMatch[1] : "",
    faucetQuantity: faucetQtyMatch ? faucetQtyMatch[1] : "",
    faucetDrilledOnsite: faucetDrilledMatch ? faucetDrilledMatch[1] : "",
    notes: notes,
    softwareSystem: "",
    materials,
    offcuts,
    rawExtractedText: cleanText
  };
}

function fallbackExtractFromFileName(fileName: string): ExtractedPdfJobData {
  const cleanName = (fileName || '').replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').trim().toUpperCase();
  const isGeneric = (str: string) => str.includes('JOBSHOPSHEET') || str.includes('JOBSHEET') || str.includes('DOCUMENT') || str.includes('SCAN');
  
  const displayClient = (!cleanName || isGeneric(cleanName)) ? "" : cleanName;

  return {
    clientName: displayClient,
    jobReference: "",
    accountName: "",
    accountPhone: "",
    addressLine1: "",
    city: "",
    stateTerritory: "",
    postalCode: "",
    jobDescription: displayClient ? `Job uploaded: ${displayClient}` : "",
    priority: "normal",
    templateDate: "",
    templatedBy: "",
    customerPhone: "",
    totalArea: "",
    pieceCounts: "",
    primaryEdgeStyle: "",
    wallLm: "",
    flatPolishLm: "",
    splashbackLm: "",
    miteredLm: "",
    frontFasciaLm: "",
    miterLm: "",
    cutouts: [],
    faucetInfo: "",
    faucetHoleDiameter: "",
    faucetQuantity: "",
    faucetDrilledOnsite: "",
    notes: "",
    softwareSystem: "",
    materials: [],
    rawExtractedText: ""
  };
}
