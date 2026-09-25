// Shapes of the data files (data/*.yaml) and of the generated site data.

export const TAGS = ['MEASURED', 'VERIFIED', 'MODELED', 'ASSUMED', 'TARGET', 'DECIDED', 'TBD'] as const;
export type Tag = (typeof TAGS)[number];
export const TRACKS = ['core', 'flight'] as const;
export type Track = (typeof TRACKS)[number];
export const PART_STATUSES = ['candidate', 'ordered', 'received', 'bench-verified', 'integrated', 'flight-qualified'] as const;
export type PartStatus = (typeof PART_STATUSES)[number];
export const INTERFACE_STATUSES = ['missing', 'draft', 'agreed'] as const;
export type InterfaceStatus = (typeof INTERFACE_STATUSES)[number];
export const APPROVAL_STATUSES = ['not_sent', 'sent', 'received'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export const RUNG_STATUSES = ['not_started', 'in_progress', 'passed'] as const;
export type RungStatus = (typeof RUNG_STATUSES)[number];
export const CONDITION_FIELDS = ['range_m', 'power_dbm', 'attenuation_db', 'bandwidth_khz', 'temperature_c', 'evidence'] as const;

export interface Person { id: string; name: string; role: string; github: string; subsystems: string[] }

export interface CitedText { text: string; cite: string; superseded_by?: string[] }
export interface Gotcha { n: number; text: string; superseded_by?: string[] }

export interface Subsystem {
  id: string; name: string; owner: string; icon: string; track: Track;
  intro: CitedText[]; gotchas: Gotcha[]; doc_refs: string[]; register_prefixes: string[];
}

export interface Conditions {
  range_m?: number; power_dbm?: number; attenuation_db?: number;
  bandwidth_khz?: number; temperature_c?: number; evidence?: string;
}

export interface RegisterRow {
  id: string; name: string; subsystem: string; value: number | string; unit: string; tag: Tag;
  owner: string; feeds_into: string[]; source: string; track: Track;
  changed: string; checked: string; note: string; conditions?: Conditions;
}

export interface PartField { name: string; value: string }
export interface Part {
  id: string; name: string; subsystem: string; track: Track; cite: string; role: string;
  status: PartStatus; chosen_part: string; candidates: string; downstream: string; gotchas: string;
  fields: PartField[]; superseded_by?: string[];
}

export interface OpenItem {
  n: number; item: string; why: string; closing_action: string; owners: string[]; due: string;
  subsystem: string; track: Track; cite: string; issue: number | null; superseded_by?: string[];
}

export interface Decision {
  date: string; area: string; decision: string; reason: string; evidence: string; changes: string;
  owner: string; subsystems: string[]; cite: string; superseded_by?: string[];
}

export interface Interface {
  id: string; from: string; to: string | string[]; what: string; owners: string[];
  status: InterfaceStatus; spec_hash: string; gap: string; blocks: string;
}

export interface Milestone { date: string; name: string; cite: string; week_of?: boolean }
export interface Rung {
  n: number; name: string; cite: string; track: Track; status: RungStatus; blocked_by: string[];
}

export interface Approval {
  id: string; name: string; authority: string; status: ApprovalStatus; date: string;
  subsystem: string; track: Track; note: string; cite: string;
}

export interface Preset { id: string; name: string; baseline?: boolean; cite: string; note: string; values: Record<string, number> }

export interface ModelConstant { value: number; tag: Tag; cite: string }
export interface SandboxControl {
  param: string; label: string; kind: 'pills' | 'slider';
  options?: number[]; min?: number; max?: number; step?: number;
}
export interface ModelConfig {
  inputs: Record<string, string>;
  constants: Record<string, ModelConstant>;
  gauge: { min_db: number; max_db: number };
  controls: SandboxControl[];
  outputs: { c1_prx: string; c1_margin: string; c2_margin: string };
  checks: { filter: string; wavelength: string };
}

export interface SiteConfig {
  title: string;
  repo: { owner: string; name: string; branch: string };
  map: { data_path: string[]; support_row: string[]; flight_row: string[] };
  recent_days: number; tbd_max_age_days: number; recent_commits: number;
  workflow_cite: string;
  workflow_rules: { title: string; text: string }[];
}

/** Everything read from data/*.yaml, before derivation. */
export interface RawData {
  site: SiteConfig;
  people: Person[];
  subsystems: Subsystem[];
  register: RegisterRow[];
  parts: Part[];
  open_items: OpenItem[];
  decisions: Decision[];
  interfaces: Interface[];
  milestones: { dates: Milestone[]; rungs: Rung[] };
  approvals: Approval[];
  presets: Preset[];
  model: ModelConfig;
  /** line number of each "- id:" in register.yaml, parts.yaml, interfaces.yaml */
  lines: Record<string, Record<string, number>>;
  /** evidence files present under evidence/ (relative paths) */
  evidence_files: string[];
}

// ---------- derived ----------

export interface Finding { level: 'error' | 'warning'; code: string; message: string; ids: string[] }

export interface StaleReason { from: string; changed: string; checked: string }
export interface RowDerived {
  stale: boolean; reasons: StaleReason[]; upstream: string[]; line: number | null;
}
export type SubsystemStatus = 'ok' | 'recheck' | 'broken';
export interface SubsystemDerived {
  status: SubsystemStatus; reasons: string[]; confidence: Partial<Record<Tag, number>>;
  rows: string[]; parts: string[]; interfaces: string[]; stale: string[];
}
export interface InterfaceDerived {
  status: InterfaceStatus; computed_hash: string; downgraded: boolean; to_list: string[]; line: number | null;
}
export interface Inbox { stale_rows: string[]; interfaces: string[] }

export interface Derived {
  rows: Record<string, RowDerived>;
  subsystems: Record<string, SubsystemDerived>;
  interfaces: Record<string, InterfaceDerived>;
  inbox: Record<string, Inbox>;
  committed: Record<string, number>;
  findings: Finding[];
}

export interface SiteData extends Omit<RawData, 'evidence_files'> {
  derived: Derived;
  built_at: string;
  today: string;
}

// ---------- history ----------
export interface FieldChange { field: string; old: unknown; new: unknown }
export interface RowChange { id: string; kind: 'added' | 'removed' | 'changed'; fields: FieldChange[] }
export interface Commit {
  sha: string; author: string; date: string; subject: string;
  changes: RowChange[]; subsystems: string[];
}
