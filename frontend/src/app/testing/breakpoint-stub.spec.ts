import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Breakpoint } from '../core/layout/breakpoint';
import { provideBreakpointStub } from './breakpoint-stub';

describe('provideBreakpointStub', () => {
  it('supplies a Breakpoint whose isDesktop() is true by default', () => {
    const stub = provideBreakpointStub();
    TestBed.configureTestingModule({ providers: [stub.providers] });

    const bp = TestBed.inject(Breakpoint);
    expect(bp.isDesktop()).toBe(true);
    expect(bp.isTablet()).toBe(false);
    expect(bp.isMobile()).toBe(false);
  });

  it('honours the isDesktop constructor argument', () => {
    const stub = provideBreakpointStub(false);
    TestBed.configureTestingModule({ providers: [stub.providers] });

    expect(TestBed.inject(Breakpoint).isDesktop()).toBe(false);
  });

  it('flips the injected signal when the test setter is called', () => {
    const stub = provideBreakpointStub(true);
    TestBed.configureTestingModule({ providers: [stub.providers] });
    const bp = TestBed.inject(Breakpoint);

    stub.isDesktop.set(false);
    expect(bp.isDesktop()).toBe(false);

    stub.isMobile.set(true);
    expect(bp.isMobile()).toBe(true);
  });

  it('the same writable signal instance is what DI hands out', () => {
    const stub = provideBreakpointStub();
    TestBed.configureTestingModule({ providers: [stub.providers] });

    expect(TestBed.inject(Breakpoint).isDesktop).toBe(stub.isDesktop);
    expect(TestBed.inject(Breakpoint)).toBe(stub.instance);
  });

  it('a component keyed off isDesktop() re-renders when the stub flips', () => {
    @Component({
      standalone: true,
      template: `<span>{{ bp.isDesktop() ? 'desktop' : 'mobile' }}</span>`,
    })
    class Host {
      readonly bp = inject(Breakpoint);
    }

    const stub = provideBreakpointStub(true);
    TestBed.configureTestingModule({ providers: [stub.providers] });
    const fixture = TestBed.createComponent(Host);
    const el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(el.textContent).toContain('desktop');

    stub.isDesktop.set(false);
    fixture.detectChanges();
    expect(el.textContent).toContain('mobile');
  });
});
