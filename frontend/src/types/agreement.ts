// Compatibility alias: some existing files import the singular name while
// the original type declarations live in agreements.ts (plural).
export type {
  AgreementPreview,
  AgreementTerm,
  AgreementTermGroup,
  SavedAgreementDraft,
} from "./agreements";
