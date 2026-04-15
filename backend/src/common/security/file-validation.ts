/**
 * File magic-byte validation.
 *
 * Relying on `file.mimetype` alone is unsafe — that value is set by the
 * uploading client and trivially spoofable. We inspect the first few bytes
 * of the buffer and match them against known signatures so a file declaring
 * `image/png` with an executable payload inside is rejected.
 */

export type AllowedImage = 'png' | 'jpeg' | 'gif' | 'webp';

const SIGNATURES: Array<{ kind: AllowedImage; bytes: number[]; offset?: number }> = [
  { kind: 'png',  bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { kind: 'jpeg', bytes: [0xff, 0xd8, 0xff] },
  { kind: 'gif',  bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8 (7a or 9a)
  { kind: 'webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // "WEBP" after RIFF header
];

export function detectImageKind(buf: Buffer): AllowedImage | null {
  if (!buf || buf.length < 12) return null;
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buf.length < offset + sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buf[offset + i] !== sig.bytes[i]) { match = false; break; }
    }
    if (match) return sig.kind;
  }
  return null;
}

export function isAllowedImage(buf: Buffer, allowed: AllowedImage[] = ['png', 'jpeg', 'gif', 'webp']): boolean {
  const kind = detectImageKind(buf);
  return kind !== null && allowed.includes(kind);
}
