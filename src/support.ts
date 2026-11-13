import { COMMUNITY_REPO } from './feedback.ts';

// Public payment destination explicitly supplied and approved for display by Alex.
// This is an email Pix key, not a QR payload, receipt, payment confirmation or secret.
export const SUPPORT = Object.freeze({
  pixKey: 'Alexpiraginet@outlook.com',
  pixKeyType: 'E-mail',
  diaryUrl: `${COMMUNITY_REPO}/blob/main/docs/DIARIO-DESENVOLVIMENTO.md`,
});

/** A successful clipboard write confirms only the copy, never a Pix transfer. */
export async function copyPixKey(writeText?: (value:string)=>Promise<void>):Promise<boolean> {
  if(!writeText)return false;
  try {await writeText(SUPPORT.pixKey);return true;} catch {return false;}
}
