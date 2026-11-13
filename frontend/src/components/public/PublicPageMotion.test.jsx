// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PublicPageMotion from './PublicPageMotion.jsx';

let intersectionObserver;
const originalMatchMedia = window.matchMedia;
const originalAnimateDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');

class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = [];
    this.observe = vi.fn((target) => this.targets.push(target));
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
    intersectionObserver = this;
  }
}

function motionContent() {
  return (
    <main>
      <section data-motion="section">Section content</section>
      <div data-motion-stagger>
        <article>First card</article>
        <article>Second card</article>
      </div>
    </main>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalMatchMedia) window.matchMedia = originalMatchMedia;
  else delete window.matchMedia;
  if (originalAnimateDescriptor) {
    Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimateDescriptor);
  } else {
    delete HTMLElement.prototype.animate;
  }
});

describe('PublicPageMotion', () => {
  it('animates visible sections and staggers card groups without hiding content initially', () => {
    const animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }));
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    window.matchMedia = vi.fn(() => ({ matches: false }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    render(<PublicPageMotion>{motionContent()}</PublicPageMotion>);

    expect(screen.getByText('Section content')).toBeVisible();
    expect(screen.getByText('First card')).toBeVisible();
    expect(animate).toHaveBeenCalledOnce();

    intersectionObserver.callback(
      intersectionObserver.targets.map((target) => ({ target, isIntersecting: true })),
    );

    expect(animate).toHaveBeenCalledTimes(4);
    expect(animate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ opacity: 0 })]),
      expect.objectContaining({ duration: 480 }),
    );
    expect(animate).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ delay: 75 }),
    );
  });

  it('keeps content visible and skips animations when reduced motion is requested', () => {
    const animate = vi.fn();
    const observerConstructor = vi.fn();
    vi.stubGlobal('IntersectionObserver', observerConstructor);
    window.matchMedia = vi.fn(() => ({ matches: true }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    render(<PublicPageMotion>{motionContent()}</PublicPageMotion>);

    expect(screen.getByText('Section content')).toBeVisible();
    expect(animate).not.toHaveBeenCalled();
    expect(observerConstructor).not.toHaveBeenCalled();
  });

  it('leaves content visible when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    window.matchMedia = vi.fn(() => ({ matches: false }));
    render(<PublicPageMotion>{motionContent()}</PublicPageMotion>);

    expect(screen.getByText('Section content')).toBeVisible();
    expect(screen.getByText('First card')).toBeVisible();
  });
});
