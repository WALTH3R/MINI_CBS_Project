import { Component, computed, input } from '@angular/core';

const TONE_CLASSES: Record<string, string> = {
  COMPLETED: 'bg-tertiary-fixed-dim/20 text-tertiary',
  CREDIT: 'bg-tertiary-fixed-dim/20 text-tertiary',
  ACTIVE: 'bg-tertiary-fixed-dim/20 text-tertiary',
  PENDING: 'bg-secondary-container/40 text-on-secondary-container',
  DEBIT: 'bg-secondary-container/40 text-on-secondary-container',
  FAILED: 'bg-error-container/60 text-on-error-container',
  INACTIVE: 'bg-error-container/60 text-on-error-container',
};

const LABELS: Record<string, string> = {
  COMPLETED: 'Completed',
  PENDING: 'Pending',
  FAILED: 'Failed',
  CREDIT: 'Credit',
  DEBIT: 'Debit',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="rounded-full px-2.5 py-1 text-label-md font-bold {{ toneClass() }}">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<string>();

  protected readonly toneClass = computed(() => TONE_CLASSES[this.status()] ?? 'bg-surface-container-high text-on-surface-variant');
  protected readonly label = computed(() => LABELS[this.status()] ?? this.status());
}
