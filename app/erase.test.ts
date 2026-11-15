import { describe, expect, it } from 'vitest';
import type { HuntStep } from '@/core/hunt';
import type { Lead, Person } from '@/core/lead';
import { DEFAULT_CADENCE, setStatus, undoStatus } from '@/core/lifecycle';
import { emptyData, type AppData } from './data';
import { deletePerson, erasePerson, nameIsCompany, namesPerson, scrubReport } from './erase';
import { writeRunReport } from './run-report';

// Invented companies, people and addresses. "Ana" is also inside "Banana",
// and a second, different Ana works at Quarry Labs.
function person(name: string, email: string): Person {
  return {
    name,
    role: 'Founder',
    contacts: [{ method: 'email', value: email, label: 'published', evidence: 'https://news.ycombinator.com/item?id=1' }],
    emailedOn: [],
    followupsSent: [],
  };
}

function lead(company: string, id: number, people: Person[], extra: Partial<Lead> = {}): Lead {
  const url = `https://news.ycombinator.com/item?id=${id}`;
  return {
    key: `${url}|${company.toLowerCase()}`,
    foundOn: '2026-11-15',
    type: 'post',
    company,
    companyUrl: '',
    about: '',
    role: 'Frontend Engineer',
    fit: 'They want React and TypeScript.',
    postedAt: '2026-11-14T15:00:00.000Z',
    postedAtApprox: false,
    likes: 'n/a',
    round: '',
    location: 'Remote',
    people,
    hooks: [],
    sources: [{ kind: 'community', url, seen: '2026-11-15' }],
    signals: [],
    tier: 'A',
    status: 'new',
    statusHistory: [{ status: 'new', at: '2026-11-15T09:00:00.000Z' }],
    snoozeUntil: null,
    attention: null,
    notes: '',
    sample: false,
    ...extra,
  };
}

const ANA = person('Ana', 'ana@bananalabs.example');
const BO = person('Bo Chen', 'bo@bananalabs.example');
const BANANA = lead('Banana Labs', 1, [ANA, BO], {
  about: 'Banana Labs makes lab notebooks.',
  fit: 'Ana asked for React, which you know well.',
  hooks: [
    { text: 'Banana Labs ships every week.', url: 'https://news.ycombinator.com/item?id=1' },
    { text: 'Ana wrote the first parser herself.', url: 'https://news.ycombinator.com/item?id=1' },
  ],
  notes: 'Ana replied fast last time.',
});
const OTHER_ANA = person('Ana', 'ana@quarrylabs.example');
const QUARRY = lead('Quarry Labs', 2, [OTHER_ANA]);

const STEPS: HuntStep[] = [{ id: 'community', state: 'done', count: 2 }];

const REPORT = writeRunReport({
  date: '2026-11-15',
  status: 'completed',
  sample: false,
  provider: 'gemini',
  kept: [BANANA, QUARRY],
  dropped: [],
  steps: STEPS,
  failedSources: [],
  unread: 0,
  usage: null,
  leads: [BANANA, QUARRY],
  cadence: DEFAULT_CADENCE,
});

function data(): AppData {
  return {
    ...emptyData(),
    leads: [BANANA, QUARRY],
    runs: [{ at: '2026-11-15T10:00:00.000Z', date: '2026-11-15', status: 'completed', kept: 2, dropped: [], sample: false, report: REPORT, reportName: '2026-11-15.md' }],
  };
}

describe('a name in text', () => {
  it('is found only as whole words, ignoring case and accents', () => {
    expect(namesPerson('Thanks, Ana Lima!', 'Ana Lima')).toBe(true);
    expect(namesPerson('ana   lima wrote it', 'Ana Lima')).toBe(true);
    expect(namesPerson('Zoe built it', 'Zoë')).toBe(true);
    expect(namesPerson('Banana Labs', 'Ana')).toBe(false);
    expect(namesPerson('Anabel', 'Ana')).toBe(false);
    expect(namesPerson('anything', 'A')).toBe(false);
  });
});

describe('deleting a person from a lead (FR-9.5)', () => {
  const { lead: erased, droppedHooks } = erasePerson(BANANA, 0);

  it('removes the person and keeps the company lead and everyone else', () => {
    expect(erased.people).toEqual([BO]);
    expect(erased.key).toBe(BANANA.key);
    expect(erased.company).toBe('Banana Labs');
    expect(erased.status).toBe('new');
  });

  it('drops a hook or fit line that names them, and keeps one that only contains the letters', () => {
    expect(droppedHooks.map((hook) => hook.text)).toEqual(['Ana wrote the first parser herself.']);
    expect(erased.hooks.map((hook) => hook.text)).toEqual(['Banana Labs ships every week.']);
    expect(erased.fit).toBe('');
    expect(erased.about).toBe('Banana Labs makes lab notebooks.');
  });

  it("keeps the user's own notes as written", () => {
    expect(erased.notes).toBe(BANANA.notes);
  });
});

describe('deleting a person from the saved data (AC-9.5)', () => {
  const before = data();
  const after = deletePerson(before, BANANA.key, 0, 'Ana');
  const report = after?.runs[0]?.report ?? '';

  it('leaves no copy of their address anywhere', () => {
    expect(after).not.toBeNull();
    expect(JSON.stringify(after).toLowerCase()).not.toContain('ana@bananalabs.example');
  });

  it("changes only the person's own lines in the report", () => {
    // The report really held them before.
    expect(REPORT).toContain('- Contact: Ana (Founder). ana@bananalabs.example');
    expect(REPORT).toContain('- Hook: Ana wrote the first parser herself.');
    expect(REPORT).toContain('- Fit: Ana asked for React');
    const expected = REPORT.split('\n')
      .flatMap((line) => {
        if (line.startsWith('- Contact: Ana (') && line.includes('ana@bananalabs.example')) return ['- Contact: (removed).'];
        if (line === '- Hook: Ana wrote the first parser herself. https://news.ycombinator.com/item?id=1') return [];
        if (line === '- Fit: Ana asked for React, which you know well.') return ['- Fit: (removed)'];
        return [line];
      })
      .join('\n');
    expect(report).toBe(expected);
    expect(report).not.toBe(REPORT);
  });

  it('keeps the other Ana at another company, the company heading and the other hook', () => {
    expect(report).toContain('- Contact: Ana (Founder). ana@quarrylabs.example');
    expect(report).toContain('- Contact: Bo Chen (Founder). bo@bananalabs.example');
    expect(report).toContain('### Banana Labs: Frontend Engineer');
    expect(report).toContain('- Hook: Banana Labs ships every week.');
    expect(after?.leads[1]).toEqual(QUARRY);
  });

  it('does nothing when the person at that place is someone else, or the lead is gone', () => {
    expect(deletePerson(before, BANANA.key, 0, 'Bo Chen')).toBeNull();
    expect(deletePerson(before, BANANA.key, 5, 'Ana')).toBeNull();
    expect(deletePerson(before, 'https://made-up.example|nobody', 0, 'Ana')).toBeNull();
  });

  it('takes their address out of any other line of a report', () => {
    const odd = '# Hunt: 2026-11-15\n\n## Notes\n\n- Wrote to ANA@BananaLabs.example by hand.';
    expect(scrubReport(odd, BANANA, ANA, [])).toBe('# Hunt: 2026-11-15\n\n## Notes\n\n- Wrote to (removed) by hand.');
  });

  it('is not brought back by an Undo of a move made just before', () => {
    const moment = new Date('2026-11-15T11:00:00.000Z');
    const moved = setStatus(BANANA, 'call', '2026-11-15', moment);
    const entry = { status: 'call' as const, at: moment.toISOString() };
    const deleted = deletePerson({ ...before, leads: [moved, QUARRY] }, BANANA.key, 0, 'Ana');
    const now = deleted?.leads[0];
    expect(now).toBeDefined();
    const undone = undoStatus(now!, BANANA, entry);
    expect(undone?.status).toBe('new');
    expect(undone?.people).toEqual([BO]);
    expect(JSON.stringify(undone)).not.toContain('ana@bananalabs.example');
  });
});

// Hacker News names a poster by their username, and companies often post as themselves.
describe('a person whose name is the company', () => {
  const HOOK = { text: 'Quillstack shipped a new editor last week.', url: 'https://news.ycombinator.com/item?id=3' };
  const posting = (name: string, companyUrl = '') =>
    lead('Quillstack', 3, [person(name, 'jobs@quillstack.example')], {
      companyUrl,
      about: 'Quillstack builds notebooks for labs.',
      fit: 'Quillstack uses React, which you know well.',
      hooks: [HOOK],
    });

  it('is told apart from the company by name, a word of the name, or the domain', () => {
    expect(nameIsCompany('quillstack', posting('quillstack'))).toBe(true);
    expect(nameIsCompany('QUILLSTACK', posting('QUILLSTACK'))).toBe(true);
    expect(nameIsCompany('quill', lead('Quill Works', 4, []))).toBe(true);
    expect(nameIsCompany('qstack', lead('Bright Notebooks', 5, [], { companyUrl: 'https://qstack.example' }))).toBe(true);
    expect(nameIsCompany('Ana', BANANA)).toBe(false);
  });

  for (const [name, companyUrl] of [
    ['quillstack', ''],
    ['Quillstack', ''],
    ['QuillStack', 'https://quillstack.example'],
  ] as const) {
    it(`keeps the company's facts when "${name}" is deleted, and removes their contact`, () => {
      const before = posting(name, companyUrl);
      const { lead: erased, droppedHooks } = erasePerson(before, 0);
      expect(erased.people).toEqual([]);
      expect(erased.about).toBe(before.about);
      expect(erased.fit).toBe(before.fit);
      expect(erased.hooks).toEqual([HOOK]);
      expect(droppedHooks).toEqual([]);
    });
  }

  it('keeps the domain-named case too', () => {
    const before = lead('Bright Notebooks', 6, [person('brightnb', 'hi@brightnb.example')], {
      companyUrl: 'https://brightnb.example',
      about: 'brightnb is the old name of Bright Notebooks.',
    });
    expect(erasePerson(before, 0).lead.about).toBe(before.about);
  });

  it("keeps the report's fit and hook lines, and replaces only the contact line", () => {
    const quill = posting('quillstack');
    const report = writeRunReport({
      date: '2026-11-15',
      status: 'completed',
      sample: false,
      provider: 'gemini',
      kept: [quill],
      dropped: [],
      steps: STEPS,
      failedSources: [],
      unread: 0,
      usage: null,
      leads: [quill],
      cadence: DEFAULT_CADENCE,
    });
    expect(report).toContain('- Contact: quillstack (Founder). jobs@quillstack.example');
    const expected = report
      .split('\n')
      .map((line) => (line.startsWith('- Contact: quillstack (') ? '- Contact: (removed).' : line))
      .join('\n');
    const saved: AppData = {
      ...emptyData(),
      leads: [quill],
      runs: [{ at: '2026-11-15T10:00:00.000Z', date: '2026-11-15', status: 'completed', kept: 1, dropped: [], sample: false, report }],
    };
    const scrubbed = deletePerson(saved, quill.key, 0, 'quillstack')?.runs[0]?.report;
    expect(scrubbed).toBe(expected);
    expect(scrubbed).toContain('- Fit: Quillstack uses React');
    expect(scrubbed).toContain('- Hook: Quillstack shipped a new editor last week.');
  });
});
