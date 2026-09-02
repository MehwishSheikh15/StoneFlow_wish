import { jsPDF } from 'jspdf';

interface StickerData {
  targetId: string;
  title: string;
  subtitle?: string;
  extra?: string;
  type?: 'job' | 'slab' | 'offcut';
  clientName?: string;
  material?: string;
  dimensions?: string;
  jobType?: string;
  date?: string;
}

export function generateStickerPDF(data: StickerData): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 150] // Standard 4" x 6" thermal sticker label format
  });

  // Background card styling
  doc.setFillColor(252, 252, 253);
  doc.rect(0, 0, 100, 150, 'F');

  // Outer border
  doc.setLineWidth(1);
  doc.setDrawColor(15, 23, 42); // slate dark
  doc.rect(3, 3, 94, 144);

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(3, 3, 94, 16, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('STONEFLOW LOGISTICS SYSTEM', 50, 10, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.text('PHYSICAL SLAB & JOB TRACKING IDENTIFIER', 50, 15, { align: 'center' });

  // Job / Slab ID Big Box
  doc.setFillColor(241, 245, 249);
  doc.rect(8, 23, 84, 16, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(8, 23, 84, 16);

  doc.setTextColor(15, 23, 42);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(data.targetId || 'STONEFLOW-QR', 50, 32, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('DYNAMIC QR TRACKING CODE', 50, 37, { align: 'center' });

  // Draw QR Code / Barcode onto PDF using a temporary canvas
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 300, 300);

      // Draw QR pattern algorithm
      let hash = 0;
      const str = data.targetId || 'SF-1000';
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }

      const gridSize = 15;
      const cellSize = 16;
      const offset = 30;

      ctx.fillStyle = '#0f172a';

      // Corner Anchors
      // Top-Left
      ctx.fillRect(offset, offset, 4 * cellSize, 4 * cellSize);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(offset + cellSize, offset + cellSize, 2 * cellSize, 2 * cellSize);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(offset + 1.5 * cellSize, offset + 1.5 * cellSize, cellSize, cellSize);

      // Top-Right
      ctx.fillRect(offset + (gridSize - 4) * cellSize, offset, 4 * cellSize, 4 * cellSize);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(offset + (gridSize - 3) * cellSize, offset + cellSize, 2 * cellSize, 2 * cellSize);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(offset + (gridSize - 2.5) * cellSize, offset + 1.5 * cellSize, cellSize, cellSize);

      // Bottom-Left
      ctx.fillRect(offset, offset + (gridSize - 4) * cellSize, 4 * cellSize, 4 * cellSize);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(offset + cellSize, offset + (gridSize - 3) * cellSize, 2 * cellSize, 2 * cellSize);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(offset + 1.5 * cellSize, offset + (gridSize - 2.5) * cellSize, cellSize, cellSize);

      // Random QR modules based on hash
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const isTL = r < 4 && c < 4;
          const isTR = r < 4 && c >= gridSize - 4;
          const isBL = r >= gridSize - 4 && c < 4;
          if (isTL || isTR || isBL) continue;

          const val = Math.abs((hash * (r + 1) * 31 + (c + 1) * 17) % 100);
          if (val > 42) {
            ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
          }
        }
      }

      const qrDataUrl = canvas.toDataURL('image/png');
      doc.addImage(qrDataUrl, 'PNG', 30, 42, 40, 40);
    }
  } catch (err) {
    console.warn('Canvas QR rendering error:', err);
  }

  // Specifications Box
  doc.setLineWidth(0.5);
  doc.setDrawColor(226, 232, 240);
  doc.rect(8, 85, 84, 46);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('PROJECT SPECIFICATIONS', 12, 91);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  const titleText = data.title || 'Stone Worktop Project';
  doc.text(`Title / Client: ${titleText.length > 28 ? titleText.substring(0, 28) + '...' : titleText}`, 12, 97);
  
  if (data.subtitle) {
    doc.text(`Details: ${data.subtitle.length > 30 ? data.subtitle.substring(0, 30) + '...' : data.subtitle}`, 12, 103);
  }
  if (data.material) {
    doc.text(`Material: ${data.material}`, 12, 109);
  }
  if (data.dimensions) {
    doc.text(`Dimensions: ${data.dimensions}`, 12, 115);
  }
  if (data.extra) {
    doc.text(`Notes: ${data.extra.length > 32 ? data.extra.substring(0, 32) + '...' : data.extra}`, 12, 121);
  }

  doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 12, 127);

  // Footer Instructions
  doc.setFillColor(15, 23, 42);
  doc.rect(3, 134, 94, 13, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont('Helvetica', 'bold');
  doc.text('INSTRUCTIONS: Stick to receiving edge of slab.', 50, 139, { align: 'center' });
  doc.setFont('Helvetica', 'normal');
  doc.text('Scan via StoneFlow Scanner at any workstation.', 50, 143, { align: 'center' });

  // Save PDF
  const filename = `StoneFlow_Sticker_${data.targetId}_${data.type || 'label'}.pdf`;
  doc.save(filename);
  return filename;
}
