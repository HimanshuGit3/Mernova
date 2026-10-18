import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { ArrowLeft, Printer, ScanLine } from 'lucide-react';
import { locationsApi } from '../../api/index.js';
import { useResource } from '../../api/useResource.js';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/States.jsx';
import { useQrSvgs, qrContent } from './useQr.js';

const PER_SHEET = 12; // 3 × 4 stickers on A4

async function fetchAll(building) {
  const all = [];
  for (let page = 1; page < 100; page += 1) {
    const res = await locationsApi.list({
      building: building || undefined,
      active: true,
      page,
      limit: 50,
    });
    all.push(...res.items);
    if (page >= res.totalPages) break;
  }
  return all;
}

/** Printable A4 sheet of room QR stickers (D9). Always light, whatever the app theme. */
export function PrintSheetPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const building = params.get('building') ?? '';
  const codes = useMemo(() => (params.get('codes') ?? '').split(',').filter(Boolean), [params]);
  const res = useResource(() => fetchAll(building), [building]);
  const rooms = (res.data ?? []).filter((l) => codes.length === 0 || codes.includes(l.code));
  const qr = useQrSvgs(rooms.map((l) => l.code));
  const ready = res.data && rooms.every((l) => qr[l.code]);
  const sheets = [];
  for (let i = 0; i < rooms.length; i += PER_SHEET) sheets.push(rooms.slice(i, i + PER_SHEET));

  return (
    <div className="min-h-dvh bg-[#E6E9F0] print:bg-white">
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-[#DFE3EC] bg-white px-4 py-3 text-[#1A2233] sm:px-6">
        <Button
          variant="ghost"
          icon={ArrowLeft}
          onClick={() => navigate('/locations')}
          className="text-[#1A2233]"
        >
          Locations
        </Button>
        <p className="flex-1 text-sm text-[#5B667C]">
          {res.data
            ? `${rooms.length} sticker${rooms.length === 1 ? '' : 's'} on ${sheets.length} A4 sheet${sheets.length === 1 ? '' : 's'}`
            : 'Preparing stickers…'}
          {building ? ` · ${building}` : ''}
        </p>
        <Button
          icon={Printer}
          onClick={() => window.print()}
          disabled={!ready || rooms.length === 0}
          className="!bg-[#1B3260] !text-white"
        >
          Print
        </Button>
      </div>
      {res.error ? (
        <ErrorState error={res.error} onRetry={res.retry} />
      ) : rooms.length === 0 && res.data ? (
        <p className="p-10 text-center text-[#5B667C]">No active rooms to print.</p>
      ) : (
        // On narrow screens the 210 mm sheets scroll sideways inside this box instead of widening the page
        <div className="relative overflow-x-auto print:overflow-visible">
          <div className="flex w-max min-w-full flex-col items-center gap-8 px-4 py-8 print:gap-0 print:p-0">
            {sheets.map((sheet, s) => (
              <section
                key={s}
                className="a4-sheet grid grid-cols-3 grid-rows-4 gap-[5mm] bg-white p-[10mm] shadow-xl print:shadow-none"
                aria-label={`Sheet ${s + 1}`}
              >
                {sheet.map((l) => (
                  <article
                    key={l.id}
                    className="flex flex-col items-center justify-between rounded-[4mm] border-[0.6mm] border-[#0F1F3D] px-[3mm] py-[2.5mm] text-center text-[#1A2233]"
                  >
                    <div className="flex w-full items-center justify-center gap-[1.5mm]">
                      <img src="/logo.svg" alt="" className="size-[6mm]" />
                      <span className="text-[3.6mm] font-extrabold text-[#0F1F3D]">
                        FixIt <span className="text-[#94690F]">Campus</span>
                      </span>
                    </div>
                    <div
                      className="size-[30mm]"
                      role="img"
                      aria-label={qrContent(l.code)}
                      dangerouslySetInnerHTML={{ __html: qr[l.code] ?? '' }}
                    />
                    <div>
                      <p className="text-[6mm] leading-none font-extrabold tracking-tight text-[#0F1F3D]">
                        {l.code}
                      </p>
                      <p className="mt-[1mm] line-clamp-1 text-[3mm] font-bold">
                        {l.label || `Room ${l.room}`}
                      </p>
                      <p className="line-clamp-1 text-[2.6mm] text-[#5B667C]">{l.building}</p>
                    </div>
                    <p className="flex w-full items-center justify-center gap-[1mm] rounded-full bg-[#0F1F3D] px-[2mm] py-[1mm] text-[2.6mm] font-bold text-white">
                      <ScanLine className="size-[3mm] text-[#E4BC63]" aria-hidden /> Scan in FixIt
                      Campus
                    </p>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
