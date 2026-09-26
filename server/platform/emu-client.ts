// LOCAL STAND-IN for the Ema template's EmuClient (see the template's
// .claude/rules/aie-platform.md). EmuClient is the only sanctioned outbound
// path from a Frontier App. When this project moves into the Ema template,
// replace this file with the template's EmuClient and keep the call sites in
// server/sources/slots.ts. Nothing here makes a network call.

export interface RunWorkflowOptions {
  timeoutMs?: number;
}

export interface EmuClientLike {
  /** Runs the workflow bound to `slotName` (an AIE slot) and resolves with its output. */
  runWorkflow(slotName: string, input: Record<string, unknown>, options?: RunWorkflowOptions): Promise<unknown>;
}

export function getEmuClient(): EmuClientLike {
  return {
    async runWorkflow(slotName) {
      throw new Error(`EmuClient is unavailable outside an Ema Frontier App workspace (slot ${slotName})`);
    },
  };
}
