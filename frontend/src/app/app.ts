import { Component, effect, inject, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Auth } from './core/auth/auth';
import { Realtime } from './core/realtime/realtime';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly auth = inject(Auth);
  private readonly realtime = inject(Realtime);

  constructor() {
    // Live invalidation runs only while signed in (no-op when realtimeUrl is empty).
    effect(() => {
      const signedIn = this.auth.user() !== null;
      untracked(() => (signedIn ? this.realtime.start() : this.realtime.stop()));
    });
  }
}
