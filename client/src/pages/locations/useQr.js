import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** QR content for a room sticker (D9). */
export const qrContent = (code) => `FIXIT:LOC:${code}`;

/** Render QR codes as SVG strings (crisp in print). Returns `{ [code]: svg }` once ready. */
export function useQrSvgs(codes) {
  const [state, setState] = useState({ key: '', svgs: {} });
  const key = codes.join('|');
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      key
        .split('|')
        .filter(Boolean)
        .map(async (code) => [
          code,
          await QRCode.toString(qrContent(code), {
            type: 'svg',
            errorCorrectionLevel: 'M',
            margin: 1,
            color: { dark: '#0F1F3D', light: '#FFFFFF' },
          }),
        ]),
    ).then((pairs) => {
      if (!cancelled) setState({ key, svgs: Object.fromEntries(pairs) });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return state.key === key ? state.svgs : {};
}
