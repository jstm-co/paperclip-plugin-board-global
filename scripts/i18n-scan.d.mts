export function scanSources(files?: string[]): { sources: Map<string, string[]>; problems: string[] };
export function placeholders(text: string): string[];
export function checkCatalog(
  sources: Map<string, string[]>,
  catalog: Readonly<Record<string, string>>,
): { missing: string[]; unused: string[]; mismatched: string[] };
