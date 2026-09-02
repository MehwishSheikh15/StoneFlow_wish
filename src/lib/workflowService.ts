import { useCallback } from 'react';
import { Job, Drawing, JobPhoto, Installation } from '../types';

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

export const STAGES = [
  { n: 1, name: 'Lead', phase: 'Sales', desc: 'Enquiry logged: contact details, source, one-line requirement' },
  { n: 2, name: 'Site Visit Required', phase: 'Sales', desc: 'Decision recorded — visit scheduled or marked not required' },
  { n: 3, name: 'Quoting', phase: 'Sales', desc: 'Price prepared and quote sent' },
  { n: 4, name: 'Quote Accepted', phase: 'Sales', desc: 'Customer confirmation logged' },
  { n: 5, name: 'Measure', phase: 'Design', desc: 'Site visit completed, measurement sheet uploaded' },
  { n: 6, name: 'Drawing', phase: 'Design', desc: 'CAD / PDF drawing completed and shared' },
  { n: 7, name: 'Client Approval', phase: 'Design', desc: "Customer's written approval logged — The Approval Gate" },
  { n: 8, name: 'Material Reserved', phase: 'Production', desc: 'Stone / slab confirmed available, reserved or ordered' },
  { n: 9, name: 'Cutting', phase: 'Production', desc: 'Stone cut to size; operator and machine logged' },
  { n: 10, name: 'CNC / Fabrication', phase: 'Production', desc: 'Shaping, cutouts, edge profiling completed' },
  { n: 11, name: 'Polishing', phase: 'Production', desc: 'Surface finishing completed' },
  { n: 12, name: 'QC Complete', phase: 'Production', desc: 'Quality checklist passed and photos uploaded' },
  { n: 13, name: 'Install Scheduled', phase: 'Installation', desc: 'Date confirmed with customer and installer' },
  { n: 14, name: 'Install Completed', phase: 'Installation', desc: 'Piece fitted; completion photos & customer sign-off' },
  { n: 15, name: 'Invoice Sent', phase: 'Accounts', desc: 'Final invoice generated and sent' },
  { n: 16, name: 'Paid', phase: 'Accounts', desc: 'Payment received and reconciled' },
  { n: 17, name: 'Closed', phase: 'Accounts', desc: 'Job marked closed and archived' }
];

/**
 * Validates whether a job can transition from its current stage to a target stage.
 * Handles sequential verification (preventing jumping), role authorization checks for gate stages,
 * and business checklist validation.
 */
export function validateStageTransition(
  job: Job,
  targetStage: number,
  currentUserRole: string,
  drawings: Drawing[] = [],
  photos: JobPhoto[] = [],
  installations: Installation[] = []
): ValidationResult {
  const currentStage = job.current_stage;

  // 1. No change is always allowed
  if (currentStage === targetStage) {
    return { allowed: true };
  }

  // 2. Backward/Retrograde transition is always allowed (for corrections/re-work)
  if (targetStage < currentStage) {
    return { allowed: true };
  }

  // 3. Prevent Stage Jumping (Forward Jumping is strictly prohibited)
  if (targetStage > currentStage + 1) {
    const nextSequentialStage = currentStage + 1;
    const stageName = STAGES.find(s => s.n === nextSequentialStage)?.name || `Stage ${nextSequentialStage}`;
    return {
      allowed: false,
      reason: `Unauthorized Stage Jump: You cannot skip steps. Please transition sequentially. Your next step must be Stage ${nextSequentialStage} (${stageName}).`
    };
  }

  // 4. Role Authorization Gates for specific critical transitions
  // - Gate 1: Moving from Stage 7 (Client Approval) -> Stage 8 (Material Reserved) (Design to Production)
  // - Gate 2: Moving from Stage 12 (QC Complete) -> Stage 13 (Install Scheduled) (Production to Install)
  // - Gate 3: Moving from Stage 16 (Paid) -> Stage 17 (Closed) (Billing to Archive/Close)
  const isGateTransition = 
    (currentStage === 7 && targetStage === 8) ||
    (currentStage === 12 && targetStage === 13) ||
    (currentStage === 16 && targetStage === 17);

  if (isGateTransition) {
    const isAuthorizedRole = currentUserRole === 'owner' || currentUserRole === 'office';
    if (!isAuthorizedRole) {
      return {
        allowed: false,
        reason: `Role Security Gate: Stage transition to ${STAGES.find(s => s.n === targetStage)?.name} requires administrative authorization (Owner or Office role).`
      };
    }
  }

  // 5. Business Checklist Verification
  
  // Transition 5 (Measure) -> 6 (Drawing): Requires a measurement sheet upload, template sheet, or at least 1 site/measurement photo uploaded
  if (currentStage === 5 && targetStage === 6) {
    const hasPhoto = photos.some(p => p.category === 'site' || p.category === 'general');
    const hasDrawing = drawings.length > 0;
    if (!hasPhoto && !hasDrawing) {
      return {
        allowed: false,
        reason: 'Checklist Incomplete: Transition to Stage 6 (Drawing) requires at least one site photo or template drawing uploaded as proof of physical measurement.'
      };
    }
  }

  // Transition 6 (Drawing) -> 7 (Client Approval): Requires drawing PDF/CAD
  if (currentStage === 6 && targetStage === 7) {
    if (drawings.length === 0) {
      return {
        allowed: false,
        reason: 'Checklist Incomplete: Transition to Stage 7 (Client Approval) requires at least one CAD or layout drawing PDF uploaded for the client to review.'
      };
    }
  }

  // Transition 7 (Client Approval) -> 8 (Material Reserved): Requires actual Client approval logged
  if (currentStage === 7 && targetStage === 8) {
    if (!job.client_approved_at) {
      return {
        allowed: false,
        reason: 'Approval Gate Locked: Client written/digital sign-off is required at Stage 7 first before you can release the job to Stage 8 (Production).'
      };
    }
  }

  // Transition 11 (Polishing) -> 12 (QC Complete): Requires QC photos uploaded
  if (currentStage === 11 && targetStage === 12) {
    const hasQcPhoto = photos.some(p => p.category === 'qc');
    if (!hasQcPhoto) {
      return {
        allowed: false,
        reason: 'Checklist Incomplete: Transition to Stage 12 (QC Complete) requires at least one Quality Control (QC) photo uploaded in the Photos tab to certify final polishing.'
      };
    }
  }

  // Transition 13 (Install Scheduled) -> 14 (Install Completed): Installer must complete all checkboxes & update installer sign-off
  if (currentStage === 13 && targetStage >= 14) {
    const inst = installations.find(i => i.job_id === job.id);
    const checklist = inst?.checklist || {};
    const requiredChecklistKeys = ['leveling', 'epoxy_joints', 'cutouts_caulk', 'photos_uploaded', 'client_walkthrough'];
    const allChecklistDone = requiredChecklistKeys.every(key => Boolean(checklist[key]));

    const hasInstallerSignoff = inst?.status === 'Completed' || Boolean(inst?.signature_name);

    if (!allChecklistDone || !hasInstallerSignoff) {
      const missingItems = [];
      if (!checklist.leveling) missingItems.push('Slabs Leveled');
      if (!checklist.epoxy_joints) missingItems.push('Epoxy Joints');
      if (!checklist.cutouts_caulk) missingItems.push('Cutouts Sealed');
      if (!checklist.photos_uploaded) missingItems.push('Site Photos Uploaded');
      if (!checklist.client_walkthrough) missingItems.push('Client Walkthrough');
      if (!hasInstallerSignoff) missingItems.push('Installer Sign-Off Updated');

      return {
        allowed: false,
        reason: `Installer Checklist Incomplete: Before advancing from Stage 13, the installer must complete all required tasks (${missingItems.join(', ')}).`
      };
    }
  }

  // Transition from Stage 14 (Install Completed) -> Billing / Closed (Stage 15, 16, 17): Requires verified Install Completed state with an installer-uploaded photo
  if (targetStage >= 15 && currentStage < 15) {
    if (currentStage < 14) {
      return {
        allowed: false,
        reason: 'Workflow Gate Locked: Job must reach the Install Completed state (Stage 14) before proceeding to Billing Closed.'
      };
    }
    const hasInstallerPhoto = photos.some(p => p.category === 'site' || p.category === 'qc');
    if (!hasInstallerPhoto) {
      return {
        allowed: false,
        reason: 'Workflow Gate Locked: Transition to Billing / Closed requires Job to be in Install Completed state verified with an installer-uploaded photo.'
      };
    }
  }

  return { allowed: true };
}

/**
 * React hook that encapsulates the logic for the 17-stage stone fabrication process.
 * Provides validation, stage constraints, and role checking utility functions.
 */
export function useWorkflowService() {
  const validateTransition = useCallback((
    job: Job,
    targetStage: number,
    currentUserRole: string,
    drawings: Drawing[] = [],
    photos: JobPhoto[] = [],
    installations: Installation[] = []
  ): ValidationResult => {
    return validateStageTransition(job, targetStage, currentUserRole, drawings, photos, installations);
  }, []);

  const canUserManageStage = useCallback((stage: number, role: string): boolean => {
    if (role === 'owner') return true;
    if (role === 'office') return [1, 2, 3, 4, 5, 6, 7, 13, 15].includes(stage);
    if (role === 'factory') return [8, 9, 10, 11, 12].includes(stage);
    if (role === 'installer') return [14].includes(stage);
    return false;
  }, []);

  const checkApprovalGateRole = useCallback((stageNum: number, role: string): boolean => {
    // Gate stages: Stage 8 (Design to Production), Stage 13 (Production to Install), Stage 17 (Billing to Archive/Close)
    const isGate = [8, 13, 17].includes(stageNum);
    if (!isGate) return true;
    return role === 'owner' || role === 'office';
  }, []);

  return {
    STAGES,
    validateTransition,
    canUserManageStage,
    checkApprovalGateRole
  };
}

/**
 * Checks if a specific stage requires an 'office' or 'owner' role to be transitioned into.
 */
export function isStageRestrictedToAdmin(targetStage: number): boolean {
  // Sensitive stages/gates that require administrative authorization:
  // - Stage 8: Material Reserved (from Design)
  // - Stage 13: Install Scheduled (from Production)
  // - Stage 17: Closed (from Billing)
  return [8, 13, 17].includes(targetStage);
}
