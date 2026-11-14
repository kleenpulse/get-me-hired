// Browser-access check for FR-2.2(a): can a page call each provider directly?
//
// CORS is enforced only by browsers, so this has to run in a real page. If
// `fetch` gives back any response we can read, even a 401, the provider allows
// browser calls with these headers. If `fetch` throws while the host is
// reachable, the browser blocked the answer.
//
// The raw checks below cost nothing. Each provider gets a GET that only checks
// the key, and a POST with an empty body to the endpoint a hunt would use,
// which the provider rejects before doing any work. The AI SDK checks live in
// sdk-probe.ts.

import { runKeyedChecks, type CheckOptions, type CheckResult } from './checks';
import { runFreeHunt, type HuntReport, type HuntStage } from './hunt';
import { PROVIDER_NAMES, providerKey, snippet, type ProviderId } from './keys';
import { runSdkChecks, type SdkResult } from './sdk-probe';

interface Provider {
  id: ProviderId;
  headers: (key: string) => Record<string, string>;
  requests: { label: string; method: 'GET' | 'POST'; url: string }[];
}

export interface ProbeResult {
  provider: ProviderId;
  request: string;
  key: 'real' | 'dummy';
  /** `readable`: the browser let the page read the answer. `blocked`: the host answered but CORS hid it. */
  access: 'readable' | 'blocked' | 'unreachable' | 'timeout';
  status: number | null;
  ms: number;
  body: string;
}

const bearer = (key: string) => ({ Authorization: `Bearer ${key}` });

const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // Anthropic refuses browser calls unless the caller opts in with this header.
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    requests: [
      { label: 'GET /v1/models', method: 'GET', url: 'https://api.anthropic.com/v1/models' },
      { label: 'POST /v1/messages', method: 'POST', url: 'https://api.anthropic.com/v1/messages' },
    ],
  },
  {
    id: 'openai',
    headers: bearer,
    requests: [
      { label: 'GET /v1/models', method: 'GET', url: 'https://api.openai.com/v1/models' },
      { label: 'POST /v1/responses', method: 'POST', url: 'https://api.openai.com/v1/responses' },
    ],
  },
  {
    id: 'gemini',
    headers: (key) => ({ 'x-goog-api-key': key }),
    requests: [
      {
        label: 'GET /v1beta/models',
        method: 'GET',
        url: 'https://generativelanguage.googleapis.com/v1beta/models',
      },
      {
        label: 'POST :generateContent',
        method: 'POST',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      },
    ],
  },
  {
    id: 'openrouter',
    headers: bearer,
    requests: [
      { label: 'GET /api/v1/key', method: 'GET', url: 'https://openrouter.ai/api/v1/key' },
      {
        label: 'POST /api/v1/chat/completions',
        method: 'POST',
        url: 'https://openrouter.ai/api/v1/chat/completions',
      },
    ],
  },
  {
    id: 'nvidia',
    headers: bearer,
    requests: [
      { label: 'GET /v1/models', method: 'GET', url: 'https://integrate.api.nvidia.com/v1/models' },
      {
        label: 'POST /v1/chat/completions',
        method: 'POST',
        url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      },
    ],
  },
  {
    id: 'firecrawl',
    headers: bearer,
    requests: [
      {
        label: 'GET /v2/team/credit-usage',
        method: 'GET',
        url: 'https://api.firecrawl.dev/v2/team/credit-usage',
      },
      { label: 'POST /v2/search', method: 'POST', url: 'https://api.firecrawl.dev/v2/search' },
      { label: 'POST /v2/scrape', method: 'POST', url: 'https://api.firecrawl.dev/v2/scrape' },
    ],
  },
];

const TIMEOUT_MS = 20_000;

/** True if the host answers at all. A `no-cors` request succeeds even when CORS would hide the answer. */
async function hostAnswers(url: string): Promise<boolean> {
  try {
    await fetch(new URL(url).origin, { mode: 'no-cors', signal: AbortSignal.timeout(TIMEOUT_MS) });
    return true;
  } catch {
    return false;
  }
}

async function probe(provider: Provider, request: Provider['requests'][number]): Promise<ProbeResult> {
  const key = providerKey(provider.id);
  const base = { provider: provider.id, request: request.label, key: key.kind } as const;
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        ...provider.headers(key.value),
        ...(request.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      body: request.method === 'POST' ? '{}' : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const ms = elapsed();
    const body = snippet(await response.text(), key.value);
    return { ...base, access: 'readable', status: response.status, ms, body };
  } catch (error) {
    const ms = elapsed();
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    // A slow host is not a CORS block: our own time limit ended the request.
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { ...base, access: 'timeout', status: null, ms, body: reason };
    }
    const reachable = await hostAnswers(request.url);
    return { ...base, access: reachable ? 'blocked' : 'unreachable', status: null, ms, body: reason };
  }
}

interface Cell {
  text: string;
  className?: string;
}

function renderRows(tbody: string, rows: Cell[][]): void {
  const elements = rows.map((cells) => {
    const tr = document.createElement('tr');
    for (const { text, className } of cells) {
      const td = document.createElement('td');
      td.textContent = text; // Provider answers are untrusted text, never HTML.
      if (className) td.className = className;
      tr.append(td);
    }
    return tr;
  });
  document.querySelector(tbody)?.replaceChildren(...elements);
}

const keyLabel = (kind: 'real' | 'dummy') => (kind === 'real' ? 'from .env.local' : 'made-up');
const statusLabel = (status: number | null) => (status === null ? 'none' : String(status));

function renderRaw(results: ProbeResult[]): void {
  renderRows(
    '#raw-results',
    results.map((result) => [
      { text: PROVIDER_NAMES[result.provider] },
      { text: result.request },
      { text: keyLabel(result.key) },
      { text: result.access, className: result.access === 'readable' ? 'pass' : 'fail' },
      { text: statusLabel(result.status) },
      { text: `${result.ms} ms` },
      { text: result.body, className: 'body' },
    ]),
  );
}

function renderSdk(results: SdkResult[]): void {
  renderRows(
    '#sdk-results',
    results.map((result) => [
      { text: PROVIDER_NAMES[result.provider] },
      { text: result.model },
      { text: keyLabel(result.key) },
      {
        text: result.outcome,
        className: result.outcome === 'answered' || result.outcome === 'api-error' ? 'pass' : 'fail',
      },
      { text: statusLabel(result.status) },
      { text: `${result.ms} ms` },
      { text: result.detail, className: 'body' },
    ]),
  );
}

declare global {
  interface Window {
    /** The last run, for reading the results from the console or a test driver. */
    spikeResults?: {
      origin: string;
      userAgent: string;
      ranAt: string;
      raw: ProbeResult[];
      sdk: SdkResult[];
    };
    spikeChecks?: Awaited<ReturnType<typeof runKeyedChecks>>;
    runSpikeChecks?: typeof runChecks;
    spikeHunt?: HuntReport;
    runSpikeHunt?: typeof runHunt;
  }
}

async function run(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>('#run');
  const status = document.querySelector('#status');
  if (button) button.disabled = true;
  if (status) status.textContent = 'Running…';

  // One request at a time, so a slow or failing host can't skew the others.
  const raw: ProbeResult[] = [];
  for (const provider of PROVIDERS) {
    for (const request of provider.requests) {
      raw.push(await probe(provider, request));
      renderRaw(raw);
    }
  }
  const sdk = await runSdkChecks(renderSdk);

  window.spikeResults = {
    origin: location.origin,
    userAgent: navigator.userAgent,
    ranAt: new Date().toISOString(),
    raw,
    sdk,
  };
  if (status) status.textContent = `Done. ${raw.length + sdk.length} requests from ${location.origin}.`;
  if (button) button.disabled = false;
}

function renderChecks(results: CheckResult[]): void {
  renderRows(
    '#check-results',
    results.map((result) => [
      { text: result.model },
      { text: result.check },
      { text: result.pass ? 'pass' : 'fail', className: result.pass ? 'pass' : 'fail' },
      { text: `${result.ms} ms` },
      { text: `${result.inputTokens ?? '?'} in, ${result.outputTokens ?? '?'} out` },
      { text: result.costUsd === null ? 'unknown' : `${result.costUsd.toFixed(5)}` },
      { text: result.notes, className: 'body' },
    ]),
  );
}

async function runChecks(
  models?: string[],
  options?: CheckOptions,
): Promise<Awaited<ReturnType<typeof runKeyedChecks>>> {
  const status = document.querySelector('#check-status');
  if (status) status.textContent = 'Running…';
  try {
    const outcome = await runKeyedChecks(models, renderChecks, options);
    window.spikeChecks = outcome;
    const total = outcome.results.reduce((sum, result) => sum + (result.costUsd ?? 0), 0);
    if (status) status.textContent = `Done. ${outcome.results.length} calls, ${total.toFixed(4)} in total.`;
    return outcome;
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

async function runHunt(stages?: HuntStage[]): Promise<HuntReport> {
  const output = document.querySelector('#hunt-report');
  if (output) output.textContent = 'Running…';
  try {
    const report = await runFreeHunt(stages);
    window.spikeHunt = report;
    if (output) output.textContent = JSON.stringify(report, null, 2);
    return report;
  } catch (error) {
    if (output) output.textContent = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

window.runSpikeChecks = runChecks;
window.runSpikeHunt = runHunt;
document.querySelector('#run-hunt')?.addEventListener('click', () => void runHunt());
document.querySelector('#run')?.addEventListener('click', () => void run());
document.querySelector('#run-checks')?.addEventListener('click', () => void runChecks());
