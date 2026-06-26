import { Component, inject, input } from '@angular/core';
import { TwitterService } from '../../services/twitter.service';
import { Tweet } from '../../models/tweet.model';

/**
 * ReplyButtonComponent — simplified direct flow.
 *
 * Clicking this button skips the internal modal entirely and opens
 * X's reply composer directly via the Intent URL.
 *
 * Flow: Click → window.open(intent URL) → X compose window (threaded)
 *
 * The internal modal is no longer needed for this flow.
 * If you want to pre-fill reply text before going to X, re-enable
 * the modal by calling this.twitter.openModal(this.tweet()) instead.
 */
@Component({
  selector: 'app-reply-button',
  standalone: true,
  templateUrl: './reply-button.component.html',
  styleUrl: './reply-button.component.scss',
})
export class ReplyButtonComponent {
  private twitter = inject(TwitterService);

  /** The tweet to reply to — id drives the in_reply_to Intent URL */
  tweet = input.required<Tweet>();

  /** Directly open X's reply composer — no internal modal */
  replyOnX(): void {
    this.twitter.openReplyIntent(this.tweet(), '');
  }
}
