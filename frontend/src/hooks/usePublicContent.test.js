// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import usePublicContent from './usePublicContent.js';
import { getPublicContent } from '../services/publicContentApi.js';

vi.mock('../services/publicContentApi.js', () => ({ getPublicContent: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  getPublicContent.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('usePublicContent refresh', () => {
  it('revalidates on the configured interval without clearing the current result', async () => {
    const firstResponse = { statistics: [{ key: 'projects', value: 1 }] };
    const refreshedResponse = { statistics: [{ key: 'projects', value: 2 }] };
    getPublicContent.mockResolvedValueOnce(firstResponse).mockResolvedValueOnce(refreshedResponse);

    const { result } = renderHook(() => usePublicContent('statistics', {}, { refreshIntervalMs: 1000 }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.data).toBe(firstResponse);

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(getPublicContent).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe(refreshedResponse);
    expect(result.current.status).toBe('success');
  });
});
