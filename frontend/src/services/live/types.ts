/**
 * Shapes returned by the FastAPI backend (/api/v1).
 * Only the fields the frontend reads are listed; the backend sends more.
 * Source of truth: http://localhost:8000/docs
 */

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LiveUser {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
}

export interface GroundingItem {
  claim: string;
  source: string;
  value: unknown;
}

export interface VoiceInfo {
  engine: "llm" | "template";
  model?: string | null;
  reason?: string | null;
}

/** A representative's statement. Every biological claim is listed in `grounding`. */
export interface Statement {
  speaker: string;
  title: string;
  avatar: string;
  species: string;
  context: string;
  lines: string[];
  text: string;
  grounding?: GroundingItem[];
  disclaimer?: string;
  topic?: string | null;
  voice?: VoiceInfo | null;
}

export interface SpeciesSummary {
  id: string;
  slug: string;
  common_name: string;
  scientific_name: string;
  taxon_group: string;
  emoji: string;
  conservation_status: string;
  is_legally_protected: boolean;
  sensitive_now: boolean;
  representative_name: string;
}

export interface SpeciesDetail extends SpeciesSummary {
  sensitive_months: number[];
  preferred_buffer_m: number;
  min_buffer_m: number;
  legal_protection: string | null;
  representative: {
    name: string;
    title: string;
    avatar_emoji: string;
    personality: string;
    tone: string;
    catchphrases: string[];
    greeting: string;
    sign_off: string;
  };
}

export interface MapLocation {
  feature_id: string;
  name: string;
  layer: string;
  lon: number;
  lat: number;
}

export type BackendConflictStatus =
  | "reported"
  | "assessed"
  | "solutions_proposed"
  | "negotiating"
  | "agreement_pending"
  | "agreed"
  | "closed";

export interface HumanActivity {
  type: string;
  description?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
  daily_hours?: string[];
  flexibility_weeks?: number;
  budget_eur?: number | null;
}

export interface ConflictCreateBody {
  title: string;
  description: string;
  species_slug: string;
  category: string;
  severity: number;
  location?: { type: "Point"; coordinates: [number, number] };
  site_feature_id?: string;
  building_feature_id?: string;
  human_activity: HumanActivity;
}

export interface LiveConflict {
  id: string;
  reporter_id: string;
  reporter_name: string | null;
  title: string;
  description: string;
  category: string;
  status: BackendConflictStatus;
  severity: number;
  lon: number;
  lat: number;
  site_feature_id: string | null;
  human_activity: HumanActivity;
  created_at: string;
  species: SpeciesSummary;
  latest_assessment_id: string | null;
  solution_count: number;
  best_index: number | null;
  negotiation_id: string | null;
  agreement_id: string | null;
  agreement_status: string | null;
  next_step: string;
}

export interface Need {
  key: string;
  side: "human" | "wildlife";
  label: string;
  description: string;
  importance: number;
  hard: boolean;
  is_legal_requirement: boolean;
}

export interface NeedPair {
  type: "conflict" | "compatible";
  human_need: string;
  wildlife_need: string;
  severity: number;
  explanation: string;
}

export interface Assessment {
  id: string;
  conflict_id: string;
  version: number;
  human_needs: Need[];
  wildlife_needs: Need[];
  conflicting_needs: NeedPair[];
  compatible_needs: NeedPair[];
  constraints: { text: string; type: string; source: string }[];
  co_benefits: { benefit: string; source: string }[];
  conflict_intensity: number;
  summary: string;
  representative_statement: Statement;
}

export interface SolutionAction {
  party: string;
  action: string;
  when: string | null;
  cost_eur: number | null;
}

export interface IndexComponent {
  key: string;
  label: string;
  score: number;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface IndexGate {
  type: string;
  passed: boolean;
  cap: number | null;
  notes: string[];
}

export interface IndexBreakdown {
  index: number;
  raw_index: number;
  grade: string;
  emoji: string;
  formula: string;
  components: IndexComponent[];
  gates: IndexGate[];
  limit_violations: string[];
}

export interface Solution {
  id: string;
  conflict_id: string;
  parent_solution_id: string | null;
  strategy: string;
  title: string;
  summary: string;
  version: number;
  status: string;
  origin: string;
  parameters: Record<string, unknown>;
  actions: SolutionAction[];
  cost_eur: number | null;
  effort: string | null;
  implementation_days: number | null;
  legal_compliant: boolean;
  legal_notes: string[];
  tradeoffs: string[];
  coexistence_index: number;
  index_breakdown: IndexBreakdown;
  representative_comment: Statement | null;
}

export interface ParameterSpec {
  name: string;
  type: "number" | "integer" | "boolean" | "text" | "choice" | "date" | string;
  label: string;
  unit: string | null;
  minimum: number | null;
  maximum: number | null;
  choices: string[] | null;
  ecological_minimum: number | null;
  description: string;
  current_value: unknown;
}

export interface NegotiationMessage {
  id: string;
  author_type: "system" | "human" | "representative" | string;
  author_name: string;
  kind: string;
  text: string;
  solution_id: string | null;
  created_at: string;
}

export interface Negotiation {
  id: string;
  conflict_id: string;
  status: string;
  rounds: number;
  current_solution_id: string | null;
  accepted_solution_id: string | null;
  current_solution: Solution | null;
  messages: NegotiationMessage[];
}

export type Verdict = "accept" | "accept_with_concerns" | "counter" | "reject";

export interface CounterProposalResult {
  verdict: Verdict;
  revision: Solution;
  counter_solution: Solution | null;
  messages: NegotiationMessage[];
  negotiation: Negotiation;
}

export interface AgreementTermRead {
  id: string;
  party: string;
  commitment: string;
  when: string | null;
  cost_eur: number | null;
}

export interface Agreement {
  id: string;
  conflict_id: string;
  solution_id: string;
  title: string;
  status: "draft" | "active" | "expired" | "terminated" | string;
  valid_from: string;
  valid_until: string;
  days_remaining: number;
  review_dates: string[];
  parties: { name: string | null; role: string; type: string; label: string; species?: string }[];
  terms: AgreementTermRead[];
  wildlife_expectations: { period: string; months: string; description: string; source: string }[];
  monitoring: { date: string; check: string; by: string }[];
  signatures: { party: string; name: string; mark: string; signed_at: string; user_id?: string }[];
  coexistence_index: number;
  markdown: string;
}

export interface AcceptResult {
  solution: Solution;
  agreement: Agreement | null;
  negotiation: Negotiation;
}

export interface ProfilePatch {
  mobility_needs?: string[];
  bio?: string | null;
  noise_tolerance?: number;
  priorities?: { safety: number; convenience: number; cost: number; nature: number; quiet: number };
}

/** GeoJSON FeatureCollection with simplestyle colours (stroke, fill, marker-color). */
export interface ScenarioCollection {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: string; coordinates: unknown };
    properties: Record<string, unknown>;
  }[];
  metadata?: Record<string, unknown>;
}
