import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TwitterExperimentService, ProbeResult } from '../../services/twitter-experiment.service';

/**
 * TweetExperimentComponent
 *
 * The experimental lab panel. Provides:
 *  - Tweet URL input → auto-extracts Tweet ID
 *  - "Run Experiment" button → probes all known endpoints
 *  - Results panel → shows probe outcome for each endpoint
 *  - Live console log → streams step-by-step experiment logs
 *  - Manual reply launcher → opens reply intent with custom text
 */
@Component({
  selector: 'app-tweet-experiment',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './tweet-experiment.component.html',
  styleUrl: './tweet-experiment.component.scss',
})
export class TweetExperimentComponent {
  protected exp = inject(TwitterExperimentService);

  /** Reply text for the manual intent launcher section */
  readonly manualReplyText = signal<string>('');

  onUrlInput(value: string): void {
    this.exp.onUrlChange(value);
  }

  runExperiment(): void {
    this.exp.runExperiment();
  }

  openManualReply(): void {
    const id = this.exp.tweetId();
    if (!id) return;
    this.exp.openReplyIntent(id, this.manualReplyText());
  }

  statusIcon(result: ProbeResult): string {
    switch (result.status) {
      case 'success':       return '✅';
      case 'cors_blocked':  return '🚫';
      case 'auth_required': return '🔐';
      case 'loading':       return '⏳';
      default:              return '❌';
    }
  }

  statusLabel(result: ProbeResult): string {
    switch (result.status) {
      case 'success':       return 'Success';
      case 'cors_blocked':  return 'CORS Blocked';
      case 'auth_required': return `Auth Required (${result.statusCode ?? '401/403'})`;
      case 'loading':       return 'Loading…';
      default:              return `Error (${result.statusCode ?? 'unknown'})`;
    }
  }
}
