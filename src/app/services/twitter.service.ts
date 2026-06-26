import { Injectable, signal, computed } from '@angular/core';
import { Tweet } from '../models/tweet.model';

/**
 * TwitterService — all Twitter/X functionality for this POC.
 *
 * KEY CHANGE: openReplyIntent() now accepts a tweetId parameter.
 * This means the Intent URL uses `in_reply_to=<tweetId>` instead of
 * just `text=<text>`, so X opens the compose window threaded under
 * the exact tweet — not a generic new tweet.
 *
 * URL structure:
 *   Generic tweet:  https://twitter.com/intent/tweet?text=...
 *   Threaded reply: https://twitter.com/intent/tweet?in_reply_to=<id>&text=...
 *   View thread:    https://twitter.com/anyuser/status/<id>
 *
 * The tweet ID comes from your NTTD stream via the backend.
 * No X API call is needed at reply time — the ID is already in your DB.
 *
 * WHY INTENT URL + in_reply_to:
 * ──────────────────────────────
 * X's Web Intent with `in_reply_to` opens the official compose window
 * pre-threaded under the specified tweet. X handles auth — if the user
 * is not logged in, X shows login first then returns to the composer.
 * No OAuth, no API key, no backend call to X required.
 *
 * HOW TO UPGRADE TO OAUTH + X API v2 (to post without leaving app):
 * ──────────────────────────────────────────────────────────────────
 * Replace openReplyIntent() with a backend call:
 *   POST /api/reply { tweetId, text }
 * Your backend then calls:
 *   POST https://api.twitter.com/2/tweets
 *   { "text": text, "reply": { "in_reply_to_tweet_id": tweetId } }
 * Cost: $0.015 per reply + OAuth setup.
 */
@Injectable({ providedIn: 'root' })
export class TwitterService {
  readonly MAX_CHARS = 280;

  /** Signal: reply text being composed */
  readonly replyText = signal<string>('');

  /** Signal: modal open/close state */
  readonly isModalOpen = signal<boolean>(false);

  /**
   * Signal: the tweet currently being replied to.
   * Set when openModal() is called — drives the modal's tweet card
   * and the in_reply_to parameter in the intent URL.
   */
  readonly activeTweet = signal<Tweet | null>(null);

  /** Computed: character count */
  readonly charCount = computed(() => this.replyText().length);

  /** Computed: characters remaining */
  readonly remainingChars = computed(() => this.MAX_CHARS - this.charCount());

  /** Computed: reply button enabled when text entered and not over limit */
  readonly canReply = computed(
    () => this.replyText().trim().length > 0 && this.remainingChars() >= 0
  );

  readonly isNearLimit = computed(() => this.remainingChars() <= 20);
  readonly isOverLimit = computed(() => this.remainingChars() < 0);

  /**
   * Open the compose modal for a specific tweet.
   * @param tweet - The tweet being replied to (id drives the intent URL)
   */
  openModal(tweet: Tweet): void {
    this.replyText.set('');
    this.activeTweet.set(tweet);
    this.isModalOpen.set(true);
  }

  /** Close the modal and clear state */
  closeModal(): void {
    this.isModalOpen.set(false);
    this.replyText.set('');
    this.activeTweet.set(null);
  }

  /** Update reply text (enforces character limit) */
  updateReplyText(text: string): void {
    if (text.length <= this.MAX_CHARS) {
      this.replyText.set(text);
    }
  }

  /**
   * buildThreadUrl
   *
   * Returns the direct URL to view the tweet thread on X.
   * X resolves the tweet by ID regardless of the username in the URL,
   * so we can use any placeholder username — or the real one if available.
   *
   * @param tweet - The tweet to link to
   */
  buildThreadUrl(tweet: Tweet): string {
    return `https://twitter.com/${tweet.username}/status/${tweet.id}`;
  }

  /**
   * buildReplyIntentUrl
   *
   * Generates the Intent URL that opens X's compose window pre-threaded
   * under the specified tweet. The `in_reply_to` parameter is the key —
   * it tells X to show the original tweet above the composer.
   *
   * @param tweet - The tweet being replied to
   * @param replyText - Text to pre-fill in the composer
   */
  buildReplyIntentUrl(tweet: Tweet, replyText: string = ''): string {
    const params = new URLSearchParams();
    params.set('in_reply_to', tweet.id);
    if (replyText.trim()) {
      params.set('text', replyText);
    }
    return `https://twitter.com/intent/tweet?${params.toString()}`;
  }

  /**
   * openReplyIntent
   *
   * Opens the X compose window in a popup, pre-threaded under the tweet.
   * If the user is not logged into X, X handles login then returns to composer.
   * After opening, the modal is closed.
   *
   * @param tweet - The tweet being replied to
   * @param replyText - The reply text to pre-fill
   */
  openReplyIntent(tweet: Tweet, replyText: string): void {
    const url = this.buildReplyIntentUrl(tweet, replyText);
    console.log('[TwitterService] Opening reply intent:', url);
    window.open(url, '_blank', 'width=650,height=700,resizable=yes,scrollbars=yes');
    this.closeModal();
  }

  /**
   * viewThread
   *
   * Opens the original tweet thread on X in a new tab.
   * No auth required — any public tweet URL works by ID.
   *
   * @param tweet - The tweet to view
   */
  viewThread(tweet: Tweet): void {
    const url = this.buildThreadUrl(tweet);
    console.log('[TwitterService] Opening thread:', url);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
