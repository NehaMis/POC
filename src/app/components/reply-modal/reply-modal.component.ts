import {
  Component,
  inject,
  viewChild,
  ElementRef,
  AfterViewInit,
  HostListener,
  computed,
} from '@angular/core';
import { TwitterService } from '../../services/twitter.service';
import { TweetCardComponent } from '../tweet-card/tweet-card.component';
import { CharacterCounterComponent } from '../character-counter/character-counter.component';

/**
 * ReplyModalComponent
 *
 * KEY CHANGE: The modal no longer takes a [tweet] input.
 * It reads the active tweet directly from TwitterService.activeTweet signal.
 * This means the tweet ID is always in sync with what openModal() was called with.
 *
 * The reply button now calls openReplyIntent(tweet, replyText) which builds:
 *   https://twitter.com/intent/tweet?in_reply_to=<tweet.id>&text=<text>
 *
 * A "View thread" link is also shown in the header so the user can
 * verify the thread before replying.
 */
@Component({
  selector: 'app-reply-modal',
  standalone: true,
  imports: [TweetCardComponent, CharacterCounterComponent],
  templateUrl: './reply-modal.component.html',
  styleUrl: './reply-modal.component.scss',
})
export class ReplyModalComponent implements AfterViewInit {
  protected twitter = inject(TwitterService);

  private textarea = viewChild<ElementRef<HTMLTextAreaElement>>('replyTextarea');

  // Signals from service
  readonly replyText = this.twitter.replyText;
  readonly charCount = this.twitter.charCount;
  readonly canReply = this.twitter.canReply;
  readonly MAX_CHARS = this.twitter.MAX_CHARS;
  readonly tweet = this.twitter.activeTweet;

  /** Computed: thread URL for the "View thread" link */
  readonly threadUrl = computed(() => {
    const t = this.tweet();
    return t ? this.twitter.buildThreadUrl(t) : '#';
  });

  ngAfterViewInit(): void {
    setTimeout(() => this.textarea()?.nativeElement.focus(), 80);
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.close();
  }

  onTextInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.twitter.updateReplyText(value);
  }

  close(): void {
    this.twitter.closeModal();
  }

  /** Opens X compose window threaded under tweet.id */
  replyOnX(): void {
    const t = this.tweet();
    if (!t || !this.canReply()) return;
    this.twitter.openReplyIntent(t, this.replyText());
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close();
    }
  }
}
