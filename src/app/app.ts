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
}
