// Open choices, part views and the schedule-clash check. Pure; shared by the
// build (lint, derive), the pages and the tests.
import type { Choice, ChoiceOption, Part, RawData, Statement, StatementStatus } from './types.ts';

export const statementText = (s: Statement) => (typeof s === 'string' ? s : s.text);
export const statementStatus = (s: Statement): StatementStatus | null => (typeof s === 'string' ? null : s.status);
export const statementSource = (s: Statement) => (typeof s === 'string' ? '' : s.source ?? '');

/** Visible stage progression; "waiting" sits before it (0 segments). */
export const STAGE_BAR = ['exploring', 'shortlisted', 'proposed', 'decided'] as const;
export const stageFilled = (stage: string) => STAGE_BAR.indexOf(stage as (typeof STAGE_BAR)[number]) + 1;

export function choiceForPart(choices: Choice[], partId: string): Choice | undefined {
  return choices.find((c) => c.parts.includes(partId));
}

/** The option that stands for the choice today: the chosen one once decided, else the leading one. */
export function activeOption(c: Choice): ChoiceOption | undefined {
  if (c.decided) return c.options.find((o) => o.name === c.decided!.option);
  return c.options.find((o) => o.status === 'leading') ?? c.options.find((o) => o.status === 'chosen');
}

const OPTION_ORDER: Record<string, number> = { chosen: 0, leading: 0, later: 1, fallback: 2, rejected: 3, obsolete: 3 };
export const sortedOptions = (c: Choice) => [...c.options].sort((a, b) => (OPTION_ORDER[a.status] ?? 9) - (OPTION_ORDER[b.status] ?? 9));

export interface PartView {
  model_line: string;
  manufacturer: string | null; mpn: string | null; supplier: string | null; supplier_pn: string | null;
  unit_cost: number | null; currency: string | null;
  /** true when these values come from an undecided choice's leading option */
  proposed: boolean;
  choice: Choice | undefined;
}

/**
 * What to show for a part. A decided choice has already been copied into the
 * part's own fields by the build; an undecided one lends its leading option,
 * always labelled (proposed), without touching the part.
 */
export function partView(choices: Choice[], p: Part): PartView {
  const c = choiceForPart(choices, p.id);
  const own: PartView = {
    model_line: p.model_line ?? '', manufacturer: p.manufacturer ?? null, mpn: p.mpn ?? null,
    supplier: p.supplier ?? null, supplier_pn: p.supplier_pn ?? null, unit_cost: p.unit_cost ?? null,
    currency: p.currency ?? null, proposed: false, choice: c,
  };
  // decided (already copied), no choice, or the part names its own model (E1's deferred pick)
  if (!c || c.decided || p.model_line) return own;
  const o = activeOption(c);
  if (!o) return own;
  return {
    model_line: `${o.name}${o.chip ? ` · ${o.chip}` : ''} (proposed)`,
    manufacturer: o.manufacturer ?? null, mpn: o.mpn ?? null, supplier: o.supplier ?? null,
    supplier_pn: o.supplier_pn ?? null, unit_cost: o.unit_price ?? null, currency: o.currency ?? null,
    proposed: true, choice: c,
  };
}

/** On decided: copy the chosen option into every part the choice decides. */
export function applyDecisions(parts: Part[], choices: Choice[]): Part[] {
  return parts.map((p) => {
    const c = choiceForPart(choices, p.id);
    if (!c?.decided) return p;
    const o = activeOption(c);
    if (!o) return p;
    return {
      ...p, manufacturer: o.manufacturer ?? null, mpn: o.mpn ?? null, supplier: o.supplier ?? null,
      supplier_pn: o.supplier_pn ?? null, unit_cost: o.unit_price ?? null, currency: o.currency ?? null,
      model_line: o.name, chosen_part: o.name,
    };
  });
}

export function designApprovalDate(raw: Pick<RawData, 'milestones'>): string | null {
  return raw.milestones.dates.find((m) => m.key === 'design_approval')?.date ?? null;
}

/** Parts a rung needs that must be ordered (not ECE stock, not department, not borrowed). */
export function mustOrder(p: Part): boolean {
  const src = String(p.source ?? '').toLowerCase().trim();
  return p.ece_stock !== 'yes' && src !== 'department' && !src.startsWith('borrow');
}

export function scheduleClashes(raw: Pick<RawData, 'milestones' | 'parts'>) {
  const approval = designApprovalDate(raw);
  if (!approval) return [];
  const byId = new Map(raw.parts.map((p) => [p.id, p]));
  return raw.milestones.rungs
    .filter((r) => r.planned && `${r.planned}-01` < approval)
    .map((r) => ({
      rung: r.n, name: r.name, planned: r.planned!,
      parts: (r.needs_parts ?? []).filter((id) => { const p = byId.get(id); return p && mustOrder(p); }),
    }))
    .filter((c) => c.parts.length);
}

export function daysTo(now: Date, iso: string | undefined): number | null {
  if (!iso) return null;
  const n = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - n) / 86_400_000);
}
export const isOpenChoice = (c: Choice) => c.stage !== 'decided';
export const dueWithin = (c: Choice, now: Date, days: number) => {
  const d = daysTo(now, c.decide_by?.date);
  return isOpenChoice(c) && d !== null && d <= days;
};
