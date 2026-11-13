import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const frontendOrigin = 'http://localhost:5174';
let fetchMock;

beforeEach(() => {
  vi.resetModules();
  fetchMock = vi.fn();
  vi.stubGlobal('window', { location: { origin: frontendOrigin } });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('same-origin API proxy', () => {
  it('loads public blog content through the Vite API proxy', async () => {
    const payload = {
      status: 'success',
      items: [],
      pagination: { page: 1, pageSize: 9, total: 0, pageCount: 0 },
    };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    const { getPublicContent } = await import('./publicContentApi.js');

    await expect(getPublicContent('blog-posts', { page: 1, pageSize: 9 })).resolves.toEqual(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      `${frontendOrigin}/api/public/blog-posts?page=1&pageSize=9`,
    );
  });

  it('verifies admin sessions through the same-origin proxy with cookies enabled', async () => {
    const payload = {
      status: 'success',
      admin: { id: 'admin-id', name: 'Admin', email: 'admin@example.com', role: 'SUPER_ADMIN' },
    };
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    const { getCurrentAdmin } = await import('./adminAuthApi.js');

    await expect(getCurrentAdmin()).resolves.toEqual(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/auth/me',
      { credentials: 'include', headers: {} },
    );
  });
});
