import { Component, input } from '@angular/core';
import { Tweet } from '../../models/tweet.model';

/**
 * TweetCardComponent
 *
 * Renders the original tweet that the user is replying to.
 * Displays avatar, display name, verified badge, username, timestamp, and tweet text.
 * The vertical connector line between the avatars mirrors the X thread design.
 */
@Component({
  selector: 'app-tweet-card',
  standalone: true,
  templateUrl: './tweet-card.component.html',
  styleUrl: './tweet-card.component.scss',
})
export class TweetCardComponent {
  /** The tweet to display */
  tweet = input.required<Tweet>();
}
