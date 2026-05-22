import { render } from '@testing-library/angular';
import type { CdkDragMove } from '@angular/cdk/drag-drop';
import { ResizeDivider } from './resize-divider';

function fakeMoveEvent(x: number, y: number): CdkDragMove {
  return {
    source: null as never,
    pointerPosition: { x, y },
    event: new MouseEvent('mousemove'),
    distance: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
  } as unknown as CdkDragMove;
}

describe('ResizeDivider', () => {
  it('renders a draggable element with the vertical class by default', async () => {
    const { fixture } = await render(ResizeDivider);
    const host = fixture.nativeElement as HTMLElement;
    const divider = host.querySelector('.divider');
    expect(divider).not.toBeNull();
    expect(divider!.classList.contains('vertical')).toBe(true);
  });

  it('emits resize with pointerPosition.x when vertical', async () => {
    const events: number[] = [];
    const { fixture } = await render(ResizeDivider);
    fixture.componentInstance.resized.subscribe((px) => events.push(px));
    fixture.componentInstance.onMove(fakeMoveEvent(250, 99));
    expect(events).toEqual([250]);
  });

  it('emits resize with pointerPosition.y when horizontal', async () => {
    const events: number[] = [];
    const { fixture } = await render(ResizeDivider, {
      inputs: { orientation: 'horizontal' },
    });
    fixture.componentInstance.resized.subscribe((px) => events.push(px));
    fixture.componentInstance.onMove(fakeMoveEvent(99, 320));
    expect(events).toEqual([320]);
  });

  it('applies the horizontal class when orientation=horizontal', async () => {
    const { fixture } = await render(ResizeDivider, {
      inputs: { orientation: 'horizontal' },
    });
    const host = fixture.nativeElement as HTMLElement;
    const divider = host.querySelector('.divider');
    expect(divider!.classList.contains('horizontal')).toBe(true);
    expect(divider!.classList.contains('vertical')).toBe(false);
  });
});
