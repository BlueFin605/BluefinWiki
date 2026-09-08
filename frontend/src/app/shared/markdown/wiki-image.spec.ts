import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { render, screen } from '@testing-library/angular';
import { WikiImage } from './wiki-image';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  TestBed.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

const httpProviders = [provideHttpClient(), provideHttpClientTesting()];

describe('WikiImage', () => {
  it('shows a loading state, then the <img> once the presign resolves', async () => {
    const { fixture } = await render(WikiImage, {
      inputs: { src: '/api/pages/g1/attachments/pic.png', alt: 'a pic' },
      providers: httpProviders,
    });
    const http = TestBed.inject(HttpTestingController);

    expect(screen.getByText(/loading image/i)).toBeInTheDocument();

    const req = http.expectOne('/api/pages/g1/attachments/pic.png');
    expect(req.request.method).toBe('GET');
    req.flush({ url: 'https://s3.example.com/signed/pic.png' });
    await settle();
    fixture.detectChanges();

    const img = (fixture.nativeElement as HTMLElement).querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://s3.example.com/signed/pic.png');
    expect(img?.getAttribute('alt')).toBe('a pic');
    http.verify();
  });

  it('builds the endpoint from [pageGuid] + [filename] inputs (4.8 reuse surface)', async () => {
    await render(WikiImage, {
      inputs: { pageGuid: 'g9', filename: 'photo 1.png' },
      providers: httpProviders,
    });
    const http = TestBed.inject(HttpTestingController);

    const req = http.expectOne('/api/pages/g9/attachments/photo%201.png');
    expect(req.request.method).toBe('GET');
    req.flush({ url: 'https://s3.example.com/signed/photo.png' });
    await settle();
    http.verify();
  });

  it('renders "Failed to load image" when the presign request errors', async () => {
    const { fixture } = await render(WikiImage, {
      inputs: { src: '/api/pages/g1/attachments/pic.png' },
      providers: httpProviders,
    });
    const http = TestBed.inject(HttpTestingController);

    http
      .expectOne('/api/pages/g1/attachments/pic.png')
      .flush('nope', { status: 500, statusText: 'Server Error' });
    await settle();
    fixture.detectChanges();

    expect(screen.getByText(/failed to load image/i)).toBeInTheDocument();
    http.verify();
  });

  it('renders an external URL directly without any presign request', async () => {
    const { fixture } = await render(WikiImage, {
      inputs: { src: 'https://cdn.example.com/x.png', alt: 'ext' },
      providers: httpProviders,
    });
    const http = TestBed.inject(HttpTestingController);

    http.expectNone(() => true);
    const img = (fixture.nativeElement as HTMLElement).querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/x.png');
    expect(screen.queryByText(/loading image/i)).not.toBeInTheDocument();
    http.verify();
  });

  it('renders a data: URL directly without any presign request', async () => {
    const { fixture } = await render(WikiImage, {
      inputs: { src: 'data:image/png;base64,AAAA' },
      providers: httpProviders,
    });
    const http = TestBed.inject(HttpTestingController);

    http.expectNone(() => true);
    expect((fixture.nativeElement as HTMLElement).querySelector('img')?.getAttribute('src')).toBe(
      'data:image/png;base64,AAAA',
    );
    http.verify();
  });

  it('emits `resize` with the final width when the drag handle is dragged', async () => {
    const { fixture } = await render(WikiImage, {
      inputs: { src: 'https://cdn.example.com/x.png', alt: 'ext', width: '100px', resizable: true },
      providers: httpProviders,
    });
    const emitted: { alt: string; width: number }[] = [];
    fixture.componentInstance.resized.subscribe((e) => emitted.push(e));

    const handle = (fixture.nativeElement as HTMLElement).querySelector('.wiki-image-handle') as HTMLElement;
    expect(handle).not.toBeNull();

    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 40, bubbles: true }));
    await settle();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].alt).toBe('ext');
    expect(emitted[0].width).toBe(140);
  });

  it('shows no drag handle when not resizable', async () => {
    const { fixture } = await render(WikiImage, {
      inputs: { src: 'https://cdn.example.com/x.png' },
      providers: httpProviders,
    });
    expect((fixture.nativeElement as HTMLElement).querySelector('.wiki-image-handle')).toBeNull();
  });
});
