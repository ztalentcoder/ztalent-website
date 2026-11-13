// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicLayout from './PublicLayout.jsx';

const originalMatchMediaDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
const originalAnimateDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');

vi.mock('../components/navigation/Header.jsx', () => ({
  default: ({ theme, onThemeToggle }) => (
    <button type="button" aria-label="Toggle theme" onClick={onThemeToggle}>{theme}</button>
  ),
}));

vi.mock('../components/layout/Footer.jsx', () => ({ default: () => null }));
vi.mock('../context/PublicContentContext.jsx', () => ({
  PublicContentProvider: ({ children }) => children,
}));

function renderPublicLayout(path = '/one') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/one" element={<><p>First public page</p><Link to="/two">Next public page</Link></>} />
          <Route path="/two" element={<p>Second public page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicLayout theme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = 'light';
    window.matchMedia = vi.fn(() => ({ matches: true }));
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.dataset.theme = 'light';
    vi.restoreAllMocks();
    if (originalMatchMediaDescriptor) {
      Object.defineProperty(window, 'matchMedia', originalMatchMediaDescriptor);
    } else {
      delete window.matchMedia;
    }
    if (originalAnimateDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimateDescriptor);
    } else {
      delete HTMLElement.prototype.animate;
    }
  });

  it('defaults to light even when the operating system prefers dark and persists across routes', () => {
    renderPublicLayout();

    expect(screen.getByRole('button', { name: 'Toggle theme' })).toHaveTextContent('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('ztalent-theme')).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(window.localStorage.getItem('ztalent-theme')).toBe('dark');

    fireEvent.click(screen.getByRole('link', { name: 'Next public page' }));
    expect(screen.getByText('Second public page')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('restores a saved theme and returns the shared document to light on unmount', () => {
    window.localStorage.setItem('ztalent-theme', 'dark');
    const { unmount } = renderPublicLayout();

    expect(screen.getByRole('button', { name: 'Toggle theme' })).toHaveTextContent('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    unmount();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('plays a short entry transition when navigating between public routes', () => {
    const animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }));
    window.matchMedia = vi.fn(() => ({ matches: false }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    renderPublicLayout();

    expect(animate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('link', { name: 'Next public page' }));
    expect(animate).toHaveBeenCalledTimes(2);
  });
});
