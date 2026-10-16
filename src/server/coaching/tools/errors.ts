export const toolErrorCodes = [
  "invalid_input",
  "not_found",
  "no_active_plan",
  "range_too_large",
  "validation_failed",
  "invalid_plan",
  "unknown_tool",
  "tool_unavailable",
] as const;

export type ToolErrorCode = (typeof toolErrorCodes)[number];

export const toolErrorMessages: Record<ToolErrorCode, string> = {
  invalid_input: "La demande de l’outil est invalide.",
  not_found: "Élément introuvable pour cet athlète.",
  no_active_plan: "Aucun plan actif.",
  range_too_large: "La période demandée est trop longue.",
  validation_failed: "La proposition ne respecte pas les règles du plan.",
  invalid_plan: "Le plan envoyé n’est pas au bon format.",
  unknown_tool: "Outil inconnu.",
  tool_unavailable: "Cet outil est momentanément indisponible.",
};

export type ToolErrorBody = {
  code: ToolErrorCode;
  message: string;
  details?: unknown;
};

export class ToolError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    readonly details?: unknown,
  ) {
    super(code);
  }

  toBody(): ToolErrorBody {
    return {
      code: this.code,
      message: toolErrorMessages[this.code],
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }
}

export function toolError(code: ToolErrorCode, details?: unknown) {
  return new ToolError(code, details);
}
