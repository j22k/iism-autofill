// Turns a completed/partial fill run's StepReport[] (src/core/fillRun.ts) into what the
// side panel shows (C7, docs/01-feature-list.md): a one-line summary and a human label
// per field, reusing core/fieldMap.ts's own source-path data rather than a second,
// separately-maintained id->label table.
import { getFieldById } from './fieldMap';
import type { StepReport } from './fillRun';
import { humanize, labelForPath } from './labels';

export interface ReportSummary {
  ok: number;
  skipped: number;
  failed: number;
  total: number;
}

export function summarizeReport(report: readonly StepReport[]): ReportSummary {
  const summary: ReportSummary = { ok: 0, skipped: 0, failed: 0, total: report.length };
  for (const entry of report) {
    summary[entry.status] += 1;
  }
  return summary;
}

// Inspired by CLAUDE.md's own example wording ("filled 21/24, 3 skipped: …") — omits a
// skipped/failed clause entirely when its count is zero, rather than printing "0 failed".
export function formatSummary(summary: ReportSummary): string {
  const parts: string[] = [];
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);
  if (summary.failed > 0) parts.push(`${summary.failed} failed`);
  const suffix = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
  return `Filled ${summary.ok}/${summary.total}${suffix}.`;
}

// Prefixed with the field's FIELD_MAP section, not just its bare source-path label —
// several real, commonly-filled fields share a last path segment once path context is
// dropped (personal.name/txtName vs emergency.name/txtEmergencyContactName both label to
// bare "Name"; ddlCourse/course.type labels to bare "Type" with no indication it's the
// course). The options page avoids this collision for free by rendering each label
// inside a section-labeled <fieldset> (core/fieldMap.ts's groupFieldsBySection); the side
// panel's flat per-field report list has no such grouping, so the section is folded into
// the label itself instead. A readonly/computed field (source: null) or an id this run
// reported on that isn't in FIELD_MAP at all (shouldn't happen — planner.ts never emits
// a step for either — but a report label is the wrong place to throw) falls back to
// humanizing the raw step id, with a section prefix if one is at least known.
export function labelForStepId(id: string): string {
  const def = getFieldById(id);
  if (!def) {
    return humanize(id);
  }
  const fieldLabel = def.source ? labelForPath(def.source) : humanize(id);
  return `${def.section} — ${fieldLabel}`;
}
