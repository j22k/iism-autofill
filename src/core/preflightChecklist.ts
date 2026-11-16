// Turns a PreflightResult (core/planner.ts) into what the side panel shows before a fill
// even starts (C11, docs/01-feature-list.md) — reuses core/fillReport.ts's labeling so a
// field reads the same way here as it does in the post-run fill report (C7).
import { labelForStepId } from './fillReport';
import type { PreflightResult } from './planner';

export interface PreflightChecklistItem {
  id: string;
  kind: 'field' | 'doc';
  label: string;
}

export function preflightChecklist(result: PreflightResult): PreflightChecklistItem[] {
  return [
    ...result.missingFields.map((id): PreflightChecklistItem => ({ id, kind: 'field', label: labelForStepId(id) })),
    ...result.missingDocs.map((id): PreflightChecklistItem => ({ id, kind: 'doc', label: labelForStepId(id) })),
  ];
}
