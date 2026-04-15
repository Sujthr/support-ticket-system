import { detectImageKind, isAllowedImage } from './file-validation';

describe('file-validation', () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
  const webpHeader = Buffer.concat([
    Buffer.from('RIFF'),                          // bytes 0-3
    Buffer.from([0x24, 0x00, 0x00, 0x00]),        // bytes 4-7 (size, any value)
    Buffer.from('WEBP'),                          // bytes 8-11
  ]);
  const svgHeader = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"...');
  const exeHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]); // MZ... PE exe

  it('detects PNG', () => expect(detectImageKind(pngHeader)).toBe('png'));
  it('detects JPEG', () => expect(detectImageKind(jpegHeader)).toBe('jpeg'));
  it('detects GIF', () => expect(detectImageKind(gifHeader)).toBe('gif'));
  it('detects WEBP', () => expect(detectImageKind(webpHeader)).toBe('webp'));

  it('rejects SVG (not a raster image)', () => expect(detectImageKind(svgHeader)).toBeNull());
  it('rejects PE executable disguised as image', () => expect(detectImageKind(exeHeader)).toBeNull());
  it('rejects empty buffer', () => expect(detectImageKind(Buffer.alloc(0))).toBeNull());
  it('rejects too-short buffer', () => expect(detectImageKind(Buffer.from([0x89, 0x50]))).toBeNull());

  it('isAllowedImage honours whitelist', () => {
    expect(isAllowedImage(pngHeader, ['png', 'jpeg'])).toBe(true);
    expect(isAllowedImage(gifHeader, ['png', 'jpeg'])).toBe(false);
    expect(isAllowedImage(svgHeader, ['png', 'jpeg', 'gif', 'webp'])).toBe(false);
  });
});
