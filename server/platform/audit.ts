// LOCAL STAND-IN for the Ema template's recordAudit() (see the template's
// .claude/rules/audit.md). Replace with the template's implementation when
// porting. Audit entries must never carry the access token.

export interface AuditEntry {
  action: string;
  resource: { type: string; id: string };
  outcome: string;
  metadata?: Record<string, unknown>;
}

export type RecordAudit = (entry: AuditEntry) => void | Promise<void>;

export const recordAudit: RecordAudit = (entry) => {
  console.info(`[audit] ${JSON.stringify({ at: new Date().toISOString(), ...entry })}`);
};
