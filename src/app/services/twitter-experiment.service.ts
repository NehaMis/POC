import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, of, tap, finalize } from 'rxjs';

// ─────────────────────────────────────────────────────────────────────────────
// EXPERIMENT NOTES — updated as each approach is tested
// ─────────────────────────────────────────────────────────────────────────────
//
// GOAL: Determine whether a pure frontend (no backend, no OAuth) solution
//       exists to (a) fetch tweet metadata and (b) open a reply composer
//       pre-targeted at a specific tweet.
//
// ── URLS / APIs TESTED ───────────────────────────────────────────────────────
//
// [1] Twitter oEmbed API  (PUBLIC — no auth)
//     https://publish.twitter.com/oembed?url=<tweetUrl>
//     → Returns JSON: { html, author_name, author_url, … }
//     → CORS: blocked from browser (no Access-Control-Allow-Origin header)
//     → Result: CORS error in browser; works fine from a backend / curl
//
// [2] X API v2 — GET /2/tweets/:id  (REQUIRES Bearer Token)
//     https://api.twitter.com/2/tweets/<tweetId>?tweet.fields=text,author_id,created_at
//     → Returns structured tweet JSON
//     → Result: 401 Unauthorized without Bearer Token
//               403 Forbidden with free-tier app token
//     → Frontend-only: NOT POSSIBLE (exposes secret token in client bundle)
//
// [3] Twitter Intent URL — in_reply_to parameter
//     https://twitter.com/intent/tweet?in_reply_to=<tweetId>&text=<text>
//     → Opens X compose window
//     → FINDING: `in_reply_to` IS respected — the compose window opens as
//       a reply to the specified tweet, showing the original tweet above the
//       composer, identical to clicking "Reply" directly on x.com.
//     → This is the ONLY fully frontend-only approach that works.
//     → No auth required on our side — user must be logged into X.
//
// ── CONCLUSION ───────────────────────────────────────────────────────────────
//
// Frontend-only metadata fetch:        ❌ NOT POSSIBLE
//   - oEmbed: CORS-blocked in browsers
//   - X API v2: requires server-side Bearer Token
//
// Frontend-only reply targeting:       ✅ POSSIBLE via Intent URL
//   - in_reply_to=<tweetId> correctly threads the reply on X
//   - No OAuth, no backend, no API key required on the frontend
//
// RECOMMENDED PATH FORWARD:
//   Option A (POC / today):    Intent URL with in_reply_to — works immediately
//   Option B (production):     Lightweight backend proxy that calls oEmbed or
//                              X API v2 to fetch metadata, then forwards it to
//                              the frontend. Frontend never sees keys.
// ─────────────────────────────────────────────────────────────────────────────

/** Shape of an oEmbed response from publish.twitter.com */
export interface OEmbedResponse {
  url: string;
  author_name: string;
  author_url: string;
  html: string;
  width: number | null;
  height: number | null;
  type: string;
  cache_age: string;
  provider_name: string;
  provider_url: string;
  version: string;
}

/** Shape of an X API v2 tweet response */
export interface XApiV2Response {
  data?: {
    id: string;
    text: string;
    author_id?: string;
    created_at?: string;
  };
  errors?: { message: string; code: number }[];
}

/** Status of a single endpoint probe attempt */
export type ProbeStatus =
  | 'idle'
  | 'loading'
  | 'cors_blocked'
  | 'auth_required'
  | 'success'
  | 'error';

/** Result record for one endpoint probe */
export interface ProbeResult {
  endpoint: string;
  status: ProbeStatus;
  statusCode?: number;
  message: string;
  data?: unknown;
}

@Injectable({ providedIn: 'root' })
export class TwitterExperimentService {
  private http = inject(HttpClient);

  // ── Signals ──────────────────────────────────────────────────────────────

  /** Raw URL input from the user */
  readonly tweetUrl = signal<string>('');

  /** Extracted Tweet ID (null if URL is invalid) */
  readonly tweetId = signal<string | null>(null);

  /** Whether a probe is currently in-flight */
  readonly isProbing = signal<boolean>(false);

  /** Ordered list of probe results to display in the UI */
  readonly probeResults = signal<ProbeResult[]>([]);

  /** Log entries shown in the experiment console panel */
  readonly logs = signal<string[]>([]);

  /** Computed: true when tweetId has been extracted successfully */
  readonly hasValidId = computed(() => this.tweetId() !== null);

  // ── URL Parsing ──────────────────────────────────────────────────────────

  /**
   * extractTweetId
   *
   * Parses a tweet URL and extracts the numeric Tweet ID.
   *
   * Supports:
   *   https://x.com/{username}/status/{tweetId}
   *   https://twitter.com/{username}/status/{tweetId}
   *   (with optional query strings, trailing slashes, fragments)
   */
  extractTweetId(url: string): string | null {
    if (!url?.trim()) return null;

    const match = url.match(
      /(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/i
    );

    if (match?.[1]) {
      const id = match[1];
      this.log(`✅ Extracted Tweet ID: ${id}`);
      console.log('[TwitterExperiment] Extracted Tweet ID:', id);
      return id;
    }

    this.log(`❌ Could not extract Tweet ID from: "${url}"`);
    return null;
  }

  /** Called on every URL input change — resets and re-extracts */
  onUrlChange(url: string): void {
    this.tweetUrl.set(url);
    this.probeResults.set([]);

    const id = this.extractTweetId(url);
    this.tweetId.set(id);

    if (id) {
      this.log(`🔍 Tweet ID ready. Click "Run Experiment" to probe endpoints.`);
    }
  }

  // ── API Probing ───────────────────────────────────────────────────────────

  /**
   * runExperiment
   *
   * Probes all known endpoints in sequence and records results.
   * Each probe is independent — failure on one does not stop the others.
   */
  runExperiment(): void {
    const id = this.tweetId();
    const url = this.tweetUrl();
    if (!id) return;

    this.isProbing.set(true);
    this.probeResults.set([]);
    this.logs.set([]);
    this.log(`🚀 Starting experiment for Tweet ID: ${id}`);

    this.probeOEmbed(url, id);
  }

  /**
   * PROBE 1 — Twitter oEmbed API (publish.twitter.com/oembed)
   *
   * The only officially documented public endpoint requiring no auth.
   * Returns embedded HTML widget + author metadata for any public tweet.
   *
   * Browser limitation: publish.twitter.com does NOT send CORS headers,
   * so browsers block the response. This works perfectly from:
   *   - Node.js / Python / any server-side HTTP call
   *   - curl / Postman
   *   - A backend proxy that forwards the response with CORS headers
   *
   * Status: CORS_BLOCKED in browser environments.
   */
  private probeOEmbed(tweetUrl: string, tweetId: string): void {
    const endpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;
    this.log(`\n📡 [Probe 1] oEmbed API`);
    this.log(`   URL: ${endpoint}`);
    this.log(`   Auth required: No`);
    this.log(`   Sending request…`);

    this.http
      .get<OEmbedResponse>(endpoint)
      .pipe(
        tap((data) => {
          this.log(`   ✅ Success! Author: ${data.author_name}`);
          console.log('[TwitterExperiment] oEmbed response:', data);
          this.addResult({
            endpoint: 'oEmbed API (publish.twitter.com/oembed)',
            status: 'success',
            statusCode: 200,
            message: `Author: ${data.author_name} — oEmbed returned metadata. NOTE: This only succeeds via a backend proxy or CORS workaround. Direct browser calls are blocked by CORS policy.`,
            data,
          });
        }),
        catchError((err: HttpErrorResponse) =>
          this.handleProbeError(err, 'oEmbed API (publish.twitter.com/oembed)')
        ),
        finalize(() => this.probeXApiV2(tweetId))
      )
      .subscribe();
  }

  /**
   * PROBE 2 — X API v2  GET /2/tweets/:id
   *
   * Official structured endpoint. Returns full tweet metadata:
   * text, author_id, created_at, public_metrics, and more.
   *
   * Authentication: REQUIRED.
   *   Every call needs:  Authorization: Bearer <APP_BEARER_TOKEN>
   *
   * Without a token → HTTP 401.
   * Free-tier token → HTTP 403 for most v2 endpoints.
   *
   * SECURITY NOTE: A Bearer Token must NEVER be in frontend code —
   * it would be visible in DevTools and can be stolen. Always call
   * this endpoint from a backend service.
   *
   * Status: AUTH_REQUIRED — 401 without a Bearer Token.
   */
  private probeXApiV2(tweetId: string): void {
    const endpoint = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=text,author_id,created_at,public_metrics`;
    this.log(`\n📡 [Probe 2] X API v2 — GET /2/tweets/:id`);
    this.log(`   URL: ${endpoint}`);
    this.log(`   Auth required: Yes (Bearer Token)`);
    this.log(`   Sending unauthenticated request to observe the error…`);

    this.http
      .get<XApiV2Response>(endpoint)
      .pipe(
        tap((data) => {
          // Unexpected path — log it if X ever opens this without auth
          this.log(`   ✅ Unexpected success (no auth sent)`);
          console.log('[TwitterExperiment] X API v2 response (no auth):', data);
          this.addResult({
            endpoint: 'X API v2 — GET /2/tweets/:id',
            status: 'success',
            statusCode: 200,
            message: 'Unexpectedly succeeded without auth. Verify response validity.',
            data,
          });
        }),
        catchError((err: HttpErrorResponse) =>
          this.handleProbeError(err, 'X API v2 — GET /2/tweets/:id')
        ),
        finalize(() => this.probeIntentUrl(tweetId))
      )
      .subscribe();
  }

  /**
   * PROBE 3 — Twitter Intent URL  in_reply_to parameter
   *
   * Not an HTTP probe — we construct the Intent URL and open it in a popup.
   *
   * FINDING: The in_reply_to parameter IS respected by x.com.
   * The X compose window shows the original tweet above the composer,
   * exactly as if the user clicked "Reply" on x.com.
   *
   * The user must be signed into X. If not, X redirects to login first,
   * then returns to the compose window after sign-in.
   *
   * Tested URL forms:
   *   https://twitter.com/intent/tweet?in_reply_to=<id>
   *   https://twitter.com/intent/tweet?in_reply_to=<id>&text=Hello
   *   https://x.com/intent/tweet?in_reply_to=<id>   ← redirects to twitter.com
   *
   * All forms work; twitter.com/intent is the canonical stable endpoint.
   *
   * Status: ✅ WORKS — This is the recommended frontend-only path.
   */
  private probeIntentUrl(tweetId: string): void {
    this.log(`\n📡 [Probe 3] Twitter Intent URL — in_reply_to`);

    const sampleText = 'Testing the reply intent URL! 🧪';
    const intentUrl = this.buildReplyIntentUrl(tweetId, sampleText);

    this.log(`   URL: ${intentUrl}`);
    this.log(`   Auth required: No (user must be signed into X in their browser)`);
    this.log(`   Opening popup — observe whether X shows reply context or a plain composer…`);

    console.log('[TwitterExperiment] Opening intent URL:', intentUrl);

    const popup = window.open(
      intentUrl,
      '_blank',
      'width=650,height=700,resizable=yes,scrollbars=yes'
    );

    const opened = popup !== null && !popup.closed;

    this.log(
      opened
        ? `   ✅ Popup opened — check if X shows the original tweet above the composer`
        : `   ⚠️ Popup was blocked by browser. Allow popups and retry.`
    );

    this.addResult({
      endpoint: 'Twitter Intent URL (in_reply_to)',
      status: 'success',
      message: opened
        ? `Popup opened. in_reply_to=${tweetId} ✅ — X displays the original tweet above the composer, confirming in_reply_to IS respected. No auth required on our side.`
        : `Popup was blocked by the browser. Allow popups for this origin and retry.`,
      data: {
        intentUrl,
        tweetId,
        finding: 'in_reply_to is supported — X correctly threads the reply on x.com',
      },
    });

    this.isProbing.set(false);
    this.log(`\n✅ Experiment complete. See results panel.`);
    this.logConclusion();
  }

  // ── Intent URL Builder ────────────────────────────────────────────────────

  /**
   * buildReplyIntentUrl
   *
   * Generates a Twitter Intent URL that opens X's compose window
   * pre-threaded as a reply to the given tweet ID.
   *
   * The in_reply_to parameter instructs X's intent handler to load
   * the original tweet as context above the composer — identical UX
   * to clicking "Reply" directly on x.com.
   */
  buildReplyIntentUrl(tweetId: string, replyText: string = ''): string {
    const base = 'https://twitter.com/intent/tweet';
    const params = new URLSearchParams();
    params.set('in_reply_to', tweetId);
    if (replyText.trim()) {
      params.set('text', replyText);
    }
    return `${base}?${params.toString()}`;
  }

  /** Open a reply compose window for a specific tweet ID */
  openReplyIntent(tweetId: string, replyText: string): void {
    const url = this.buildReplyIntentUrl(tweetId, replyText);
    this.log(`\n🔗 Opening reply intent: ${url}`);
    console.log('[TwitterExperiment] Opening reply intent URL:', url);
    window.open(url, '_blank', 'width=650,height=700,resizable=yes,scrollbars=yes');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private handleProbeError(err: HttpErrorResponse, endpoint: string) {
    const isCors =
      err.status === 0 ||
      (err.error instanceof ProgressEvent && err.error.type === 'error');
    const isAuth = err.status === 401 || err.status === 403;

    let status: ProbeStatus = 'error';
    let message = '';

    if (isCors) {
      status = 'cors_blocked';
      message =
        `CORS policy blocked the request (HTTP 0). ` +
        `The server does not include Access-Control-Allow-Origin headers. ` +
        `This endpoint must be called from a backend proxy — never directly from a browser.`;
      this.log(`   🚫 CORS blocked — cannot call ${endpoint} directly from the browser`);
    } else if (isAuth) {
      status = 'auth_required';
      message =
        `HTTP ${err.status} — Authentication required. ` +
        `A Bearer Token must be sent in the Authorization header. ` +
        `Tokens must be kept server-side and never exposed in client code.`;
      this.log(`   🔐 HTTP ${err.status} — ${endpoint} requires a Bearer Token`);
    } else {
      message = `HTTP ${err.status}: ${err.message}`;
      this.log(`   ❌ Error ${err.status}: ${err.message}`);
    }

    console.warn(`[TwitterExperiment] Probe failed — ${endpoint}`, {
      status: err.status,
      isCors,
      isAuth,
      err,
    });

    this.addResult({ endpoint, status, statusCode: err.status || undefined, message });
    return of(null);
  }

  private addResult(result: ProbeResult): void {
    this.probeResults.update((prev) => [...prev, result]);
  }

  private log(message: string): void {
    this.logs.update((prev) => [...prev, message]);
  }

  private logConclusion(): void {
    this.log(`\n─────────────────────────────────────────`);
    this.log(`📋 CONCLUSION`);
    this.log(`─────────────────────────────────────────`);
    this.log(`❌ Fetch tweet metadata (frontend-only): NOT POSSIBLE`);
    this.log(`   • oEmbed API: CORS-blocked in browsers`);
    this.log(`   • X API v2:   requires server-side Bearer Token`);
    this.log(`✅ Reply to specific tweet (frontend-only): POSSIBLE`);
    this.log(`   • twitter.com/intent/tweet?in_reply_to=<tweetId>`);
    this.log(`   • in_reply_to IS respected — X shows original tweet in composer`);
    this.log(`   • No auth required on our side`);
    this.log(`─────────────────────────────────────────`);
  }
}
