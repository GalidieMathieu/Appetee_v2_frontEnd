export type AvifFileSelectionResult =
  | { kind: 'empty'; input: HTMLInputElement | null; file: null }
  | { kind: 'invalid-type'; input: HTMLInputElement | null; file: null }
  | { kind: 'valid'; input: HTMLInputElement; file: File };

// Reads a file input event and normalizes it into AVIF-specific states.
export function readAvifFileSelection(event: Event): AvifFileSelectionResult {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0] ?? null;

  if (!input || !file) {
    return {
      kind: 'empty',
      input,
      file: null,
    };
  }

  if (!isAvifFile(file)) {
    return {
      kind: 'invalid-type',
      input,
      file: null,
    };
  }

  return {
    kind: 'valid',
    input,
    file,
  };
}

// Checks whether the selected file is an AVIF image.
function isAvifFile(file: File): boolean {
  return file.type === 'image/avif' || file.name.toLowerCase().endsWith('.avif');
}
