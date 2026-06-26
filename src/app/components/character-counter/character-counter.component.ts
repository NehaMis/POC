import { Component, input, computed } from '@angular/core';

/**
 * CharacterCounterComponent
 *
 * Displays a circular SVG progress ring + numeric remaining count.
 * Mirrors the X compose window counter aesthetic.
 * Color transitions: neutral → warning (≤20) → danger (≤0).
 */
@Component({
  selector: 'app-character-counter',
  standalone: true,
  imports: [],
  templateUrl: './character-counter.component.html',
  styleUrl: './character-counter.component.scss',
})
export class CharacterCounterComponent {
  /** Current number of characters typed */
  charCount = input.required<number>();

  /** Maximum allowed characters */
  maxChars = input<number>(280);

  /** Radius of the SVG ring */
  readonly radius = 16;

  /** Circumference of the ring */
  readonly circumference = 2 * Math.PI * this.radius;

  /** Computed: characters remaining */
  remaining = computed(() => this.maxChars() - this.charCount());

  /** Computed: fraction of limit used (0–1, capped at 1) */
  fraction = computed(() =>
    Math.min(this.charCount() / this.maxChars(), 1)
  );

  /** Computed: SVG dash offset to animate the ring */
  dashOffset = computed(
    () => this.circumference * (1 - this.fraction())
  );

  /** Computed: ring color class */
  ringClass = computed(() => {
    if (this.remaining() < 0) return 'ring--danger';
    if (this.remaining() <= 20) return 'ring--warning';
    return 'ring--default';
  });

  /** Computed: label class for the remaining text */
  labelClass = computed(() => {
    if (this.remaining() < 0) return 'label--danger';
    if (this.remaining() <= 20) return 'label--warning';
    return 'label--hidden';
  });
}
