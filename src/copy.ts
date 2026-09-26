import type { Panelist } from '../shared/types';
import { toMinutes } from '../shared/time';

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

export const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

/** ["A"] → "A"; ["A","B"] → "A and B"; ["A","B","C"] → "A, B, and C" */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** The interview length when every slot has the same length, else null. */
export function uniformDurationMinutes(panel: readonly Panelist[]): number | null {
  const lengths = new Set(panel.flatMap((p) => p.slots.map((s) => toMinutes(s.end) - toMinutes(s.start))));
  return lengths.size === 1 ? [...lengths][0] : null;
}

export function introCopy(candidateName: string, role: string, panel: readonly Panelist[]): string {
  const n = panel.length;
  const minutes = uniformDurationMinutes(panel);
  const length = minutes ? `${minutes}-minute ` : '';
  const hello = `Hi ${firstName(candidateName)}, thanks for your interest in the ${role} role.`;
  if (n === 1) {
    return `${hello} You'll have one ${length}interview with ${panel[0].name}. Please pick a time that works for you.`;
  }
  return `${hello} You'll have ${numberWord(n)} ${length}interviews, one with each member of your interview panel. Please pick one time with each person.`;
}

export function missingHelper(missing: readonly Panelist[]): string {
  return `Choose a time with ${joinNames(missing.map((p) => p.name))} to continue.`;
}
