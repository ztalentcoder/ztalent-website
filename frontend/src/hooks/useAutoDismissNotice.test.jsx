// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useAutoDismissNotice from './useAutoDismissNotice.js';

function NoticeExample() {
  const [notice, setNotice] = useAutoDismissNotice();
  return (
    <div>
      <button type="button" onClick={() => setNotice('First action succeeded.')}>First</button>
      <button type="button" onClick={() => setNotice('Second action succeeded.')}>Second</button>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

describe('useAutoDismissNotice', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('clears the previous timeout and dismisses the latest notice after three seconds', () => {
    vi.useFakeTimers();
    render(<NoticeExample />);

    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('status')).toHaveTextContent('Second action succeeded.');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('cleans up the timeout when the component unmounts', () => {
    vi.useFakeTimers();
    const { unmount } = render(<NoticeExample />);
    fireEvent.click(screen.getByRole('button', { name: 'First' }));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
