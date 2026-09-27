import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Pages } from '../pages/pages';
import { PageTitleResolver } from './page-title-resolver';

describe('PageTitleResolver', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('resolves a guid to its page title via Pages.fetchPage', async () => {
    const pages = TestBed.inject(Pages);
    jest
      .spyOn(pages, 'fetchPage')
      .mockResolvedValue({ guid: 'g1', title: 'My Page' } as never);
    const resolver = TestBed.inject(PageTitleResolver);

    await expect(resolver.resolveTitle('g1')).resolves.toBe('My Page');
  });

  it('falls back to the guid itself when the lookup fails', async () => {
    const pages = TestBed.inject(Pages);
    jest.spyOn(pages, 'fetchPage').mockRejectedValue(new Error('404'));
    const resolver = TestBed.inject(PageTitleResolver);

    await expect(resolver.resolveTitle('missing-guid')).resolves.toBe('missing-guid');
  });

  it('caches a resolved title so a repeat lookup does not re-fetch', async () => {
    const pages = TestBed.inject(Pages);
    const spy = jest
      .spyOn(pages, 'fetchPage')
      .mockResolvedValue({ guid: 'g1', title: 'My Page' } as never);
    const resolver = TestBed.inject(PageTitleResolver);

    await resolver.resolveTitle('g1');
    await resolver.resolveTitle('g1');

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
