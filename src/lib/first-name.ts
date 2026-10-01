/** The public share page shows a first name, never an email. */
export function firstName(personName: string): string {
  const first = personName.trim().split(/\s+/)[0];
  return first || personName.trim();
}

export function photoEntryPath(code: string): string {
  return `/p/${code}`;
}
