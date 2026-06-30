import { Component } from '@angular/core';
import { ReplyButtonComponent } from './components/reply-button/reply-button.component';
import { EmbedExperimentComponent } from './components/embed-experiment/embed-experiment.component';
import { MOCK_TWEET } from './models/tweet.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ReplyButtonComponent, EmbedExperimentComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly mockTweet = MOCK_TWEET;

  /** Optional pre-filled reply text appended after the @mention */
  readonly messageText = '';

  /** Open X's reply composer in a centered popup window */
  openPopup(): void {
    openXReplyPopup(this.mockTweet.id, this.mockTweet.username, this.messageText);
  }
}

/**
 * Opens X's reply composer in a centered popup window pre-threaded under a tweet.
 *
 * @param tweetId     Tweet ID to reply to (drives in_reply_to)
 * @param username    Author handle (with or without leading @)
 * @param messageText Text to pre-fill after the @mention
 */
function openXReplyPopup(tweetId: string, username: string, messageText: string): void {
  // 1. Generate and URL-encode the standard intent string
  const cleanUsername = username.replace(/^@/, '');
  const completeMessage = `@${cleanUsername} ${messageText}`;
  const encodedText = encodeURIComponent(completeMessage);
  const intentUrl = `https://x.com/intent/tweet?in_reply_to=${tweetId}&text=${encodedText}`;

  // 2. Define standard X Intent dimensions
  const width = 550;
  const height = 420;

  // 3. Calculate position to center the popup on the engineer's screen
  const left = Math.round((window.screen.width / 2) - (width / 2));
  const top = Math.round((window.screen.height / 2) - (height / 2));

  // 4. Define window feature properties
  const windowFeatures = `popup=yes,scrollbars=yes,resizable=yes,toolbar=no,location=yes,width=${width},height=${height},left=${left},top=${top}`;

  // 5. Open the localized popup window
  window.open(intentUrl, 'XReplyIntentWindow', windowFeatures);
}
