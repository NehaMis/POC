import {
  Component,
  signal,
  ElementRef,
  viewChild,
} from '@angular/core';

/**
 * EmbedExperimentComponent
 *
 * Attempts to load X inside an iframe and captures the block error.
 * The sandbox attribute is intentionally REMOVED — it was suppressing
 * the X-Frame-Options error from appearing in the browser console.
 */
@Component({
  selector: 'app-embed-experiment',
  standalone: true,
  templateUrl: './embed-experiment.component.html',
  styleUrl: './embed-experiment.component.scss',
})
export class EmbedExperimentComponent {

  readonly attempted = signal<boolean>(false);
  readonly errorCaught = signal<string>('');

  private iframe = viewChild<ElementRef<HTMLIFrameElement>>('embedIframe');

  readonly intentUrl =
    'https://twitter.com/intent/tweet?in_reply_to=1016181746992969994&text=test';

  attemptEmbed(): void {
    this.attempted.set(true);
    this.errorCaught.set('');

    // Also attempt via fetch so we can capture the CORS/block error in the app
    fetch(this.intentUrl, { mode: 'no-cors' })
      .then(() => {
        // no-cors succeeds silently but iframe will still be blocked
      })
      .catch((err: Error) => {
        this.errorCaught.set(err.message);
      });

    // Set iframe src after render — this triggers the real browser console error:
    // "Refused to display 'twitter.com/intent/tweet' in a frame because it set
    //  X-Frame-Options to deny."
    setTimeout(() => {
      const el = this.iframe()?.nativeElement;
      if (el) {
        el.src = '';
        setTimeout(() => { el.src = this.intentUrl; }, 50);
      }
    }, 100);
  }

  reset(): void {
    const el = this.iframe()?.nativeElement;
    if (el) el.src = 'about:blank';
    this.attempted.set(false);
    this.errorCaught.set('');
  }
}
