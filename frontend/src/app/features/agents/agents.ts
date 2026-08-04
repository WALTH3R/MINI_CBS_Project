import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { AgentService } from '../../core/services/agent.service';
import { Agent } from '../../core/models/agent.model';
import { TransientSignal } from '../../shared/utils/transient-signal';
import { StatusBadge } from '../../shared/status-badge/status-badge';

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [StatusBadge],
  templateUrl: './agents.html',
})
export class Agents {
  private readonly agentService = inject(AgentService);

  protected readonly agents = signal<Agent[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  private readonly togglingId = signal<string | null>(null);
  protected isToggling(id: string): boolean {
    return this.togglingId() === id;
  }

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly submitting = signal(false);
  private readonly submitErrorMsg = new TransientSignal<string>();
  protected readonly submitError = this.submitErrorMsg.value;
  private readonly createdMsg = new TransientSignal<string>();
  protected readonly created = this.createdMsg.value;

  constructor() {
    this.loadAgents();
  }

  private loadAgents(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.agentService.list().subscribe({
      next: (agents) => {
        this.agents.set(agents);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load agents.');
        this.loading.set(false);
      },
    });
  }

  submitCreate(): void {
    if (!this.username() || !this.password() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.submitErrorMsg.set(null);

    this.agentService
      .create({
        username: this.username(),
        password: this.password(),
        first_name: this.firstName(),
        last_name: this.lastName(),
      })
      .subscribe({
        next: (agent) => {
          this.agents.update((agents) => [...agents, agent].sort((a, b) => a.username.localeCompare(b.username)));
          this.username.set('');
          this.password.set('');
          this.firstName.set('');
          this.lastName.set('');
          this.submitting.set(false);
          this.createdMsg.set(`Agent "${agent.username}" created.`);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          if (err instanceof HttpErrorResponse && Array.isArray(err.error?.username)) {
            this.submitErrorMsg.set(err.error.username.join(' '));
          } else {
            this.submitErrorMsg.set('Could not create this agent. The username may already be taken.');
          }
        },
      });
  }

  toggleActive(agent: Agent): void {
    if (this.togglingId()) {
      return;
    }
    this.togglingId.set(agent.id);
    this.agentService.setActive(agent.id, !agent.is_active).subscribe({
      next: (updated) => {
        this.agents.update((agents) => agents.map((a) => (a.id === updated.id ? updated : a)));
        this.togglingId.set(null);
      },
      error: () => {
        this.submitErrorMsg.set('Could not update this agent.');
        this.togglingId.set(null);
      },
    });
  }
}
