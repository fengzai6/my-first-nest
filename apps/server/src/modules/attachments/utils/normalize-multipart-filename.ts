export const normalizeMultipartFilename = (filename: string): string => {
  const hasNonAsciiCharacter = Array.from(filename).some(
    (character) => character.charCodeAt(0) > 0x7f,
  );

  if (!hasNonAsciiCharacter) return filename;

  const bytes = Buffer.from(filename, 'latin1');
  const decoded = bytes.toString('utf8');

  // Only undo the known latin1 misdecode when the original string actually
  // looks like UTF-8 byte sequences. Otherwise a correct CJK filename such as
  // "中.pdf" is turned into "-.pdf".
  const decodedBytes = Buffer.from(decoded, 'utf8');
  const isRoundTrip =
    decodedBytes.toString('latin1') === filename && !decoded.includes('\uFFFD');

  return isRoundTrip && decoded !== filename ? decoded : filename;
};
