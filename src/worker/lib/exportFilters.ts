import {
  parseAnalysisScope,
  type AnalysisFilterInput
} from "../../shared/analysisFilters";

export function parseExportFilters(query: (name: string) => string | undefined): AnalysisFilterInput {
  return parseAnalysisScope(query);
}
