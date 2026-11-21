import { liveRequest } from "./client";
import type {
  AcceptResult,
  Agreement,
  Assessment,
  ConflictCreateBody,
  CounterProposalResult,
  LiveConflict,
  MapLocation,
  Negotiation,
  NegotiationMessage,
  ParameterSpec,
  ProfilePatch,
  ScenarioCollection,
  Solution,
  SpeciesDetail,
  SpeciesSummary,
  Statement,
} from "./types";

/** One function per backend endpoint the frontend uses. */
export const liveApi = {
  listSpecies: () => liveRequest<SpeciesSummary[]>("/species"),
  getSpecies: (slug: string) => liveRequest<SpeciesDetail>(`/species/${slug}`),
  introduction: (slug: string) => liveRequest<Statement>(`/species/${slug}/representative`),
  ask: (slug: string, question: string) =>
    liveRequest<Statement>(`/species/${slug}/representative/ask`, { method: "POST", body: { question } }),

  locations: () => liveRequest<MapLocation[]>("/map/locations"),
  /** Each species' home on the demo map (den, nest, roost...). */
  wildlifeSites: () => liveRequest<ScenarioCollection>("/map/features?layers=wildlife_site"),
  scenario: (solutionId: string) =>
    liveRequest<ScenarioCollection>(`/map/scenarios/${solutionId}?simplestyle=true`),

  createConflict: (body: ConflictCreateBody) =>
    liveRequest<LiveConflict>("/conflicts", { method: "POST", body }),
  listConflicts: (mine = false) => liveRequest<LiveConflict[]>(`/conflicts${mine ? "?mine=true" : ""}`),
  getConflict: (id: string) => liveRequest<LiveConflict>(`/conflicts/${id}`),

  getAssessment: (id: string) => liveRequest<Assessment>(`/conflicts/${id}/assessment`),
  runAssessment: (id: string) => liveRequest<Assessment>(`/conflicts/${id}/assessment`, { method: "POST" }),

  listSolutions: (id: string) => liveRequest<Solution[]>(`/conflicts/${id}/solutions`),
  generateSolutions: (id: string) =>
    liveRequest<Solution[]>(`/conflicts/${id}/solutions/generate`, { method: "POST", body: { max_solutions: 4 } }),
  getSolution: (solutionId: string) => liveRequest<Solution>(`/solutions/${solutionId}`),
  parameters: (solutionId: string) => liveRequest<ParameterSpec[]>(`/solutions/${solutionId}/parameters`),

  getNegotiation: (id: string) => liveRequest<Negotiation>(`/conflicts/${id}/negotiation`),
  openNegotiation: (id: string, solutionId: string) =>
    liveRequest<Negotiation>(`/conflicts/${id}/negotiation`, { method: "POST", body: { solution_id: solutionId } }),
  sendMessage: (id: string, message: string) =>
    liveRequest<NegotiationMessage[]>(`/conflicts/${id}/negotiation/messages`, { method: "POST", body: { message } }),
  counterProposal: (id: string, solutionId: string, changes: Record<string, unknown>, message?: string) =>
    liveRequest<CounterProposalResult>(`/conflicts/${id}/negotiation/counter-proposals`, {
      method: "POST",
      body: { solution_id: solutionId, changes, message: message || undefined },
    }),
  accept: (id: string, solutionId: string) =>
    liveRequest<AcceptResult>(`/conflicts/${id}/negotiation/accept`, {
      method: "POST",
      body: { solution_id: solutionId, generate_agreement: true },
    }),

  getAgreement: (agreementId: string) => liveRequest<Agreement>(`/agreements/${agreementId}`),
  signAgreement: (agreementId: string) =>
    liveRequest<Agreement>(`/agreements/${agreementId}/sign`, { method: "POST", body: {} }),

  getProfile: () => liveRequest<{ priorities: Record<string, number> }>("/profiles/me"),
  patchProfile: (body: ProfilePatch) => liveRequest<unknown>("/profiles/me", { method: "PATCH", body }),
};
