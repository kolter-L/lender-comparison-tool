import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CSV_PATH, csvUrl, loadPrograms } from '../loadPrograms';
import { CSV_COLUMNS } from '../parseProgram';

const HEADER = CSV_COLUMNS.join(',');
const ROW_A =
  'First National Bank,Community Advantage,10000,250000,620,Fair,1,11,13.6,84,85,All,Varies,0.5,23,No recent bankruptcies (7 years),1/16/2026';
const ROW_B =
  'Coastal Capital,504 Loan,250000,5000000,680,Good,2,7,7.7,240,40,Manufacturing,Yes,,73,,1/23/2026';

/** Minimal stand-in for the one Response shape loadPrograms touches. */
function respondWith(body: string, init: Partial<Response> = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/csv' }),
        text: async () => body,
        ...init,
      }) as unknown as Response),
  );
}

const warn = vi.fn();

beforeEach(() => {
  warn.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(warn);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('csvUrl', () => {
  it('cache-busts with the injected clock, never Date.now (F28, N8)', () => {
    const url = csvUrl(new Date(2026, 8, 30, 12, 0, 0));
    expect(url).toBe(`${CSV_PATH}?v=${new Date(2026, 8, 30, 12, 0, 0).getTime()}`);
  });

  it('produces a different URL after an ops update', () => {
    expect(csvUrl(new Date(1))).not.toBe(csvUrl(new Date(2)));
  });
});

describe('loadPrograms', () => {
  const now = new Date(2026, 8, 30);

  it('parses a well-formed file into typed programs', async () => {
    respondWith([HEADER, ROW_A, ROW_B].join('\n'));
    const programs = await loadPrograms(now);

    expect(programs).toHaveLength(2);
    expect(programs[0]!.lenderName).toBe('First National Bank');
    expect(programs[0]!.maxTermMonths).toBe(84);
    // Blank cells in ROW_B stay null rather than becoming 0 / ''.
    expect(programs[1]!.maxExistingDebtRatio).toBeNull();
    expect(programs[1]!.specialRequirements).toBeNull();
  });

  it('assigns every loaded program a unique id, even for duplicate rows', async () => {
    // ROW_A twice: same lender and program type, so the old composite key would collide.
    respondWith([HEADER, ROW_A, ROW_A, ROW_B].join('\n'));
    const programs = await loadPrograms(now);

    expect(programs.map((p) => p.id)).toEqual(['row-2', 'row-3', 'row-4']);
    expect(new Set(programs.map((p) => p.id)).size).toBe(programs.length);
    expect(programs[0]!.lenderName).toBe(programs[1]!.lenderName);
  });

  it('requests the cache-busted URL with no-store (F28)', async () => {
    respondWith([HEADER, ROW_A].join('\n'));
    await loadPrograms(now);

    expect(fetch).toHaveBeenCalledWith(csvUrl(now), { cache: 'no-store' });
  });

  it('tolerates a trailing newline, as the real file has', async () => {
    respondWith([HEADER, ROW_A, ''].join('\n'));
    await expect(loadPrograms(now)).resolves.toHaveLength(1);
  });

  // --- F27: every failure is explicit, never a silent blank screen ---------

  it('rejects on a failed fetch, quoting the status', async () => {
    respondWith('', { ok: false, status: 404, statusText: 'Not Found' });
    await expect(loadPrograms(now)).rejects.toThrow(/404 Not Found/);
  });

  it('rejects on an empty file', async () => {
    respondWith('   \n  ');
    await expect(loadPrograms(now)).rejects.toThrow(/empty/i);
  });

  it('reports a missing file when the host falls back to index.html (200 + HTML)', async () => {
    respondWith('<!doctype html>\n<html><body><div id="root"></div></body></html>');
    await expect(loadPrograms(now)).rejects.toThrow(/No rate data file found/);
  });

  it('reports a missing file when the content type says HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'text/html' }),
          text: async () => 'lender_name\nAcme',
        }) as unknown as Response),
    );
    await expect(loadPrograms(now)).rejects.toThrow(/No rate data file found/);
  });

  it('rejects when a required column is missing', async () => {
    const shortHeader = CSV_COLUMNS.filter((c) => c !== 'interest_rate_max').join(',');
    respondWith([shortHeader, ROW_A].join('\n'));
    await expect(loadPrograms(now)).rejects.toThrow(/missing required columns/);
  });

  it('rejects a header-only file (zero parsed rows)', async () => {
    respondWith(HEADER);
    await expect(loadPrograms(now)).rejects.toThrow(/contains no programs/);
  });

  // --- one bad row must not cost the rep the whole rate sheet --------------

  it('drops a single bad row and keeps the rest', async () => {
    const badRow = ROW_A.replace(',Fair,', ',Platinum,').replace('First National', 'Broken Bank');
    respondWith([HEADER, ROW_A, badRow, ROW_B].join('\n'));

    const programs = await loadPrograms(now);

    expect(programs).toHaveLength(2);
    expect(programs.map((p) => p.lenderName)).toEqual(['First National Bank', 'Coastal Capital']);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain('Rejected 1 of 3 rows');
    expect(String(warn.mock.calls[0]![1])).toMatch(/not a known tier/);
  });

  it('keeps ids pinned to the CSV line, so a skipped row does not renumber the rest', async () => {
    const badRow = ROW_A.replace(',Fair,', ',Platinum,');
    respondWith([HEADER, badRow, ROW_A, ROW_B].join('\n'));

    const programs = await loadPrograms(now);

    // Line 2 was rejected; the survivors keep lines 3 and 4 rather than sliding to 2 and 3.
    expect(programs.map((p) => p.id)).toEqual(['row-3', 'row-4']);
  });

  it('counts every bad row, not just the first', async () => {
    const bad = (name: string) =>
      ROW_A.replace(',Fair,', ',Platinum,').replace('First National Bank', name);
    respondWith([HEADER, bad('A'), ROW_A, bad('B'), bad('C')].join('\n'));

    const programs = await loadPrograms(now);

    expect(programs).toHaveLength(1);
    expect(warn.mock.calls[0]![0]).toContain('Rejected 3 of 4 rows');
  });

  it('drops a row PapaParse itself flags, without failing the file', async () => {
    const tooManyFields = `${ROW_A},surprise-extra-column`;
    respondWith([HEADER, ROW_A, tooManyFields, ROW_B].join('\n'));

    const programs = await loadPrograms(now);

    expect(programs).toHaveLength(2);
    expect(warn.mock.calls[0]![0]).toContain('Rejected 1 of 3 rows');
    expect(String(warn.mock.calls[0]![1])).toMatch(/row 3/);
  });

  it('says nothing when every row is good', async () => {
    respondWith([HEADER, ROW_A, ROW_B].join('\n'));
    await loadPrograms(now);
    expect(warn).not.toHaveBeenCalled();
  });

  it('still fails when every row is bad — that is a blank screen (F27)', async () => {
    const bad = ROW_A.replace(',Fair,', ',Platinum,');
    respondWith([HEADER, bad, bad].join('\n'));

    await expect(loadPrograms(now)).rejects.toThrow(
      /no usable programs \(all 2 rows were rejected\)/,
    );
  });

  it('rejects when the network itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('NetworkError'); }));
    await expect(loadPrograms(now)).rejects.toThrow(/NetworkError/);
  });
});
