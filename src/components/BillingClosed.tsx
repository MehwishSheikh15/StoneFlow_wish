import React from 'react';
import { Receipt, DollarSign, ArrowRight, ShieldCheck, Mail, Download } from 'lucide-react';
import { Job } from '../types';
import { dbSync as dbMock, STAGES } from '../lib/dbSync';
import { useCurrency } from '../lib/currency';

interface BillingClosedProps {
  jobs: Job[];
  onJobSelect: (jobId: string) => void;
  onToast: (msg: string, isWarn?: boolean) => void;
  currentUser: any;
}

export const BillingClosed: React.FC<BillingClosedProps> = ({
  jobs,
  onJobSelect,
  onToast,
  currentUser
}) => {
  const { format } = useCurrency();
  // Filter jobs at Stage 4 (Quote Accepted) or Stages 14 to 17 or any with an existing invoice
  const invoicesList = dbMock.getInvoices();
  const billingJobs = jobs.filter(j => j.current_stage === 4 || j.current_stage >= 14 || invoicesList.some(i => i.job_id === j.id));

  // Financial KPIs
  const quoteAcceptedJobs = jobs.filter(j => j.current_stage === 4);
  const paidJobs = jobs.filter(j => j.current_stage === 16 || j.current_stage === 17);
  const sentJobs = jobs.filter(j => j.current_stage === 15);
  const pendingBillJobs = jobs.filter(j => j.current_stage === 14);

  const totalPaidSum = paidJobs.reduce((sum, j) => sum + j.value, 0);
  const totalSentSum = sentJobs.reduce((sum, j) => sum + j.value, 0);
  const totalPendingBillSum = pendingBillJobs.reduce((sum, j) => sum + j.value, 0);

  const handleInvoiceAction = async (jobId: string, clientName: string, action: 'send' | 'paid' | 'close') => {
    if (action === 'send') {
      await dbMock.updateStage(jobId, 15, currentUser.id, currentUser.name);
      onToast(`Invoice generated and emailed to ${clientName} (Stage 15)`);
    } else if (action === 'paid') {
      await dbMock.updateStage(jobId, 16, currentUser.id, currentUser.name);
      onToast(`Funds reconciled! Mark ${clientName} as Paid in full (Stage 16)`);
    } else if (action === 'close') {
      await dbMock.updateStage(jobId, 17, currentUser.id, currentUser.name);
      onToast(`Job for ${clientName} closed and archived (Stage 17)`);
    }
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = billingJobs.map(job => {
      const stageName = STAGES.find(s => s.n === job.current_stage)?.name || '';
      let statusText = 'Pending Invoice';
      if (job.current_stage === 15) statusText = 'Invoice Issued';
      else if (job.current_stage >= 16) statusText = 'Paid & Settled';

      const inv = invoicesList.find(i => i.job_id === job.id);
      const descText = job.material ? `${job.job_type || 'Custom Work'} — ${job.material}` : (job.job_type || 'Custom Stone Fabrication');

      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${job.id}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${job.client_name || 'N/A'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-size: 11px;">
            <div><strong>${job.job_type || 'Custom'}</strong></div>
            <div style="color: #475569; margin-top: 2px;">${descText}</div>
            ${inv?.invoice_notes ? `<div style="color: #d97706; font-style: italic; margin-top: 2px;">Note: ${inv.invoice_notes}</div>` : ''}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">Stage ${job.current_stage}: ${stageName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: 600;">${statusText}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">$${(job.value || 0).toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>StoneFlow CRM - Accounts Billing PDF Report</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1e293b; }
            h1 { margin-bottom: 4px; color: #0f172a; font-size: 20px; }
            p { font-size: 12px; color: #64748b; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
            th { text-align: left; background: #f1f5f9; padding: 10px 8px; border-bottom: 2px solid #cbd5e1; font-weight: 700; color: #334155; }
          </style>
        </head>
        <body>
          <h1>STONEFLOW CRM — Accounts & Billing PDF Report</h1>
          <p>Generated: ${new Date().toLocaleString()} • Active Invoicing Jobs: ${billingJobs.length}</p>
          <table>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Client</th>
                <th>Description &amp; Specs</th>
                <th>Current Stage</th>
                <th>Financial Status</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-disp font-extrabold text-ink tracking-tight">Billing &amp; Closed</h1>
          <p className="text-xs text-mut mt-1">
            Stages 15–17 • Accounts receivable, invoice transmissions, receipts, and project close archives
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          className="px-4 py-2.5 bg-paper border border-line text-ink font-semibold rounded-xl text-xs hover:border-mut transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          title="Export current billing sheet to PDF Document"
        >
          <Download className="w-4 h-4 text-zinc-500" />
          Export Accounts PDF
        </button>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Paid & Settled */}
        <div className="bg-paper border border-line p-5 rounded-2xl relative shadow-sm">
          <div className="absolute left-0 top-4 bottom-4 w-1 bg-em rounded-r" />
          <div className="flex items-center gap-2 text-xs font-semibold text-mut">
            <ShieldCheck className="w-4.5 h-4.5 text-em" />
            Paid &amp; Settled (Stage 16-17)
          </div>
          <div className="text-2xl font-disp font-extrabold text-ink mt-2.5 tnum">
            {format(totalPaidSum)}
          </div>
          <p className="text-[10px] text-mut font-semibold mt-1 uppercase">
            {paidJobs.length} settled accounts
          </p>
        </div>

        {/* Invoiced & Outstanding */}
        <div className="bg-paper border border-line p-5 rounded-2xl relative shadow-sm">
          <div className="absolute left-0 top-4 bottom-4 w-1 bg-am rounded-r" />
          <div className="flex items-center gap-2 text-xs font-semibold text-mut">
            <Mail className="w-4.5 h-4.5 text-am" />
            Invoiced &amp; Outstanding (Stage 15)
          </div>
          <div className="text-2xl font-disp font-extrabold text-ink mt-2.5 tnum">
            {format(totalSentSum)}
          </div>
          <p className="text-[10px] text-mut font-semibold mt-1 uppercase">
            {sentJobs.length} active invoices sent
          </p>
        </div>

        {/* Ready to Invoice */}
        <div className="bg-paper border border-line p-5 rounded-2xl relative shadow-sm">
          <div className="absolute left-0 top-4 bottom-4 w-1 bg-sap rounded-r" />
          <div className="flex items-center gap-2 text-xs font-semibold text-mut">
            <Receipt className="w-4.5 h-4.5 text-sap" />
            Completed — Ready to Bill (Stage 14)
          </div>
          <div className="text-2xl font-disp font-extrabold text-ink mt-2.5 tnum">
            {format(totalPendingBillSum)}
          </div>
          <p className="text-[10px] text-mut font-semibold mt-1 uppercase">
            {pendingBillJobs.length} freshly fitted jobs
          </p>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-paper border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-soft border-b border-line text-[10px] tracking-widest text-mut uppercase font-semibold text-left">
                <th className="py-3 px-6">Client / Job Details</th>
                <th className="py-3 px-6">Material &amp; Specifications</th>
                <th className="py-3 px-6">Current Workflow Stage</th>
                <th className="py-3 px-6">Invoice Status</th>
                <th className="py-3 px-6">Total Value</th>
                <th className="py-3 px-6 text-right">Quick Billing Operations</th>
              </tr>
            </thead>
            <tbody>
              {billingJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-mut">
                    No active accounts waiting at invoicing phases.
                  </td>
                </tr>
              ) : (
                billingJobs.map((job) => {
                  const stageName = STAGES.find(s => s.n === job.current_stage)?.name || '';
                  const inv = invoicesList.find(i => i.job_id === job.id);

                  let statusText = 'Pending';
                  let statusColor = 'bg-slatesoft text-slate border-slate/10';

                  if (job.current_stage === 4) {
                    statusText = 'Quote Accepted (Deposit Invoice)';
                    statusColor = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300';
                  } else if (job.current_stage === 15) {
                    statusText = 'Invoiced';
                    statusColor = 'bg-amsoft text-am border-am/10';
                  } else if (job.current_stage >= 16) {
                    statusText = 'Paid';
                    statusColor = 'bg-emsoft text-em border-em/10';
                  }

                  return (
                    <tr 
                      key={job.id}
                      className="border-b border-soft last:border-0 hover:bg-soft/40 transition-colors cursor-pointer"
                      onClick={() => onJobSelect(job.id)}
                    >
                      <td className="py-4.5 px-6">
                        <div className="text-sm font-bold text-ink leading-tight">
                          {job.client_name}
                        </div>
                        <div className="text-xs text-mut mt-1">
                          {job.id} • {job.job_type}
                        </div>
                        {job.site_address && (
                          <div className="text-[10px] text-mut mt-0.5 truncate max-w-[180px]">
                            📍 {job.site_address}
                          </div>
                        )}
                      </td>

                      <td className="py-4.5 px-6 max-w-xs">
                        <div className="text-xs font-bold text-ink leading-snug">
                          {job.material || job.job_type || 'Custom Stone Work'}
                        </div>
                        <div className="text-[11px] text-mut font-medium mt-0.5">
                          {job.job_type || 'Stone Fabrication'}
                        </div>
                        {inv?.invoice_notes && (
                          <p className="text-[10px] text-am font-medium mt-1 line-clamp-1">
                            📝 {inv.invoice_notes}
                          </p>
                        )}
                      </td>

                      <td className="py-4.5 px-6">
                        <span className="text-xs text-ink font-semibold">
                          {stageName}
                        </span>
                      </td>

                      <td className="py-4.5 px-6">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor}`}>
                          {statusText.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-4.5 px-6">
                        <span className="text-sm font-disp font-extrabold text-ink tnum">
                          {format(job.value)}
                        </span>
                      </td>

                      <td className="py-4.5 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2 justify-end items-center">
                          <button
                            onClick={() => onJobSelect(job.id)}
                            className="px-2.5 py-1.5 bg-soft hover:bg-line text-ink font-semibold rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer border border-line"
                            title="Open Job Sheet / Job Detail"
                          >
                            📄 Job Sheet
                          </button>

                          {/* Stage 4 Quote Accepted -> View or Generate Deposit Invoice */}
                          {job.current_stage === 4 && (
                            <button
                              onClick={() => {
                                const existing = dbMock.getInvoices().find(i => i.job_id === job.id);
                                if (!existing) dbMock.createInvoice(job.id, job.value || 2500);
                                onToast(`Deposit Invoice ready for ${job.client_name}`);
                              }}
                              className="px-3.5 py-1.5 bg-indigo-600 text-white font-semibold rounded-lg text-xs hover:bg-indigo-700 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              Client Invoice Ready
                            </button>
                          )}

                          {/* Ready to Invoice -> Send */}
                          {job.current_stage === 14 && (
                            <button
                              onClick={() => handleInvoiceAction(job.id, job.client_name, 'send')}
                              className="px-3.5 py-1.5 bg-sap text-white font-semibold rounded-lg text-xs hover:opacity-90 transition-all flex items-center gap-1"
                            >
                              Send Invoice
                            </button>
                          )}

                          {/* Invoiced -> paid */}
                          {job.current_stage === 15 && (
                            <button
                              onClick={() => handleInvoiceAction(job.id, job.client_name, 'paid')}
                              className="px-3.5 py-1.5 bg-em text-white font-semibold rounded-lg text-xs hover:opacity-90 transition-all"
                            >
                              Mark as Paid
                            </button>
                          )}

                          {/* Paid -> Close */}
                          {job.current_stage === 16 && (
                            <button
                              onClick={() => handleInvoiceAction(job.id, job.client_name, 'close')}
                              className="px-3.5 py-1.5 bg-sidebg text-white font-semibold rounded-lg text-xs hover:opacity-90 transition-all dark:bg-zinc-200 dark:text-black"
                            >
                              Archive &amp; Close
                            </button>
                          )}

                          {job.current_stage === 17 && (
                            <span className="text-xs font-semibold text-em flex items-center gap-1 justify-end">
                              ✓ Completed Account
                            </span>
                          )}

                          <button
                            onClick={() => onJobSelect(job.id)}
                            className="p-1.5 hover:bg-soft rounded-lg text-mut hover:text-ink transition-all"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
