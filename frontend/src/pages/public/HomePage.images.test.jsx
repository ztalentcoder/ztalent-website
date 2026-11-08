// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import usePublicContent from '../../hooks/usePublicContent.js';
import HomePage from './HomePage.jsx';

vi.mock('../../hooks/usePublicContent.js', () => ({ default: vi.fn() }));
vi.mock('../../context/PublicContentContext.jsx', () => ({
  usePublicCompany: () => ({ company: null }),
}));

const areas = [
  { name: 'Academic', slug: 'academic', imageUrl: 'https://images.example.test/academic.webp' },
  { name: 'Tech Solutions', slug: 'tech-solutions', imageUrl: null },
  { name: 'Data & AI', slug: 'data-ai', imageUrl: 'https://images.example.test/data.webp' },
];

beforeEach(() => {
  usePublicContent.mockImplementation((resource) => ({
    data: { items: resource === 'business-areas' ? areas : [] },
    status: 'success',
  }));
});

afterEach(cleanup);

describe('HomePage business area images', () => {
  it('renders CMS images with alternative text and falls back when an image fails', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    expect(screen.getByAltText('Academic business area')).toHaveAttribute('src', areas[0].imageUrl);
    expect(screen.getByAltText('Data & AI business area')).toHaveAttribute('src', areas[2].imageUrl);
    expect(screen.queryByRole('img', { name: 'Tech Solutions business area' })).not.toBeInTheDocument();

    fireEvent.error(screen.getByAltText('Data & AI business area'));
    expect(screen.queryByRole('img', { name: 'Data & AI business area' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'What we do' })).getAllByRole('article')).toHaveLength(3);
  });
});

describe('HomePage hero slideshow', () => {
  it('synchronizes slide images and copy, supports direct navigation, and loops automatically', () => {
    vi.useFakeTimers();
    try {
      render(<MemoryRouter><HomePage /></MemoryRouter>);

      expect(screen.getByRole('heading', { name: 'We Teach Talent, Build Solutions and Turn Data Into Decisions' })).toBeInTheDocument();
      expect(screen.getByText('Ztalent Coder helps students learn to code, gives institutions the systems they need, and helps organizations make sense of their data.')).toBeInTheDocument();
      expect(document.querySelector('.hero-illustration')).not.toBeInTheDocument();
      expect(document.querySelector('[style*="image1.jpg"]')).toHaveAttribute('style', expect.stringContaining('/images/image1.jpg'));

      act(() => vi.advanceTimersByTime(5000));
      fireEvent.click(screen.getByRole('button', { name: 'Show slide 2: Web & Mobile Development' }));
      expect(screen.getByRole('heading', { name: 'Building Digital Experiences That Matter' })).toBeInTheDocument();
      expect(screen.getByText('We design and develop modern websites, web applications, and mobile solutions that help businesses and individuals grow, connect, and succeed in the digital world.')).toBeInTheDocument();
      expect(document.querySelector('[style*="image2.jpg"]')).toHaveAttribute('style', expect.stringContaining('/images/image2.jpg'));

      act(() => vi.advanceTimersByTime(6000));
      expect(screen.getByRole('heading', { name: 'Turning Data into Intelligent Solutions' })).toBeInTheDocument();
      expect(document.querySelector('[style*="image3.avif"]')).toHaveAttribute('style', expect.stringContaining('/images/image3.avif'));

      act(() => vi.advanceTimersByTime(6000));
      expect(screen.getByRole('heading', { name: 'We Teach Talent, Build Solutions and Turn Data Into Decisions' })).toBeInTheDocument();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it('disables autoplay when reduced motion is requested', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: true }));
    vi.useFakeTimers();
    try {
      render(<MemoryRouter><HomePage /></MemoryRouter>);
      act(() => vi.advanceTimersByTime(18000));
      expect(screen.getByRole('heading', { name: 'We Teach Talent, Build Solutions and Turn Data Into Decisions' })).toBeInTheDocument();
    } finally {
      cleanup();
      vi.useRealTimers();
      window.matchMedia = originalMatchMedia;
    }
  });
});
