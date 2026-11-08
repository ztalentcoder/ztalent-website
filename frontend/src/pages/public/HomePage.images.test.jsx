// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import usePublicContent from '../../hooks/usePublicContent.js';
import HomePage from './HomePage.jsx';

const companyState = vi.hoisted(() => ({ company: null }));

vi.mock('../../hooks/usePublicContent.js', () => ({ default: vi.fn() }));
vi.mock('../../context/PublicContentContext.jsx', () => ({
  usePublicCompany: () => companyState,
}));

const areas = [
  { name: 'Academic', slug: 'academic', imageUrl: 'https://images.example.test/academic.webp' },
  { name: 'Tech Solutions', slug: 'tech-solutions', imageUrl: null },
  { name: 'Data & AI', slug: 'data-ai', imageUrl: 'https://images.example.test/data.webp' },
];

beforeEach(() => {
  companyState.company = null;
  usePublicContent.mockImplementation((resource) => ({
    data: resource === 'statistics'
      ? { statistics: [] }
      : { items: resource === 'business-areas' ? areas : [] },
    status: 'success',
  }));
});

afterEach(cleanup);

describe('HomePage business area images', () => {
  it('uses the default home intro image and honors a configured CMS image', () => {
    const { rerender } = render(<MemoryRouter><HomePage /></MemoryRouter>);
    const introImage = () => screen.getByRole('img', {
      name: "A coding workspace representing Ztalent Coder's training and technology solutions",
    });

    expect(introImage()).toHaveAttribute('src', '/images/image1.jpg');

    companyState.company = { homeIntroImageUrl: 'https://images.example.test/home-intro.webp' };
    rerender(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(introImage()).toHaveAttribute('src', 'https://images.example.test/home-intro.webp');
  });

  it('falls back to the default home intro image when a configured image fails', () => {
    companyState.company = { homeIntroImageUrl: 'https://images.example.test/unavailable.webp' };
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    const introImage = screen.getByRole('img', {
      name: "A coding workspace representing Ztalent Coder's training and technology solutions",
    });

    fireEvent.error(introImage);
    expect(introImage).toHaveAttribute('src', '/images/image1.jpg');
  });

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
  it('tilts only the background layers with mouse position and resets on pointer leave', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn((query) => ({ matches: query.includes('pointer: fine') }));
    try {
      render(<MemoryRouter><HomePage /></MemoryRouter>);
      const hero = document.querySelector('#home');
      vi.spyOn(hero, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        top: 50,
        width: 200,
        height: 100,
        right: 300,
        bottom: 150,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      });

      const positions = [
        { x: 100, y: 50, tiltX: '3deg', tiltY: '-3deg' },
        { x: 300, y: 50, tiltX: '3deg', tiltY: '3deg' },
        { x: 100, y: 150, tiltX: '-3deg', tiltY: '-3deg' },
        { x: 300, y: 150, tiltX: '-3deg', tiltY: '3deg' },
        { x: 200, y: 50, tiltX: '3deg', tiltY: '0deg' },
        { x: 300, y: 100, tiltX: '0deg', tiltY: '3deg' },
      ];
      for (const position of positions) {
        fireEvent.pointerMove(hero, {
          pointerType: 'mouse',
          clientX: position.x,
          clientY: position.y,
        });
        expect(hero.style.getPropertyValue('--hero-tilt-x')).toBe(position.tiltX);
        expect(hero.style.getPropertyValue('--hero-tilt-y')).toBe(position.tiltY);
      }
      expect(hero.querySelector('[class*="heroContent"]').style.transform).toBe('');
      fireEvent.pointerLeave(hero);
      expect(hero.style.getPropertyValue('--hero-tilt-x')).toBe('0deg');
      expect(hero.style.getPropertyValue('--hero-tilt-y')).toBe('0deg');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('does not apply the pointer tilt for touch pointers or reduced motion', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn((query) => ({ matches: query.includes('pointer: fine') }));
    try {
      render(<MemoryRouter><HomePage /></MemoryRouter>);
      const hero = document.querySelector('#home');
      vi.spyOn(hero, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}),
      });
      fireEvent.pointerMove(hero, { pointerType: 'touch', clientX: 100, clientY: 100 });
      expect(hero.style.getPropertyValue('--hero-tilt-x')).toBe('');

      window.matchMedia = vi.fn((query) => ({ matches: query.includes('pointer: fine') || query.includes('reduced-motion') }));
      fireEvent.pointerMove(hero, { pointerType: 'mouse', clientX: 100, clientY: 100 });
      expect(hero.style.getPropertyValue('--hero-tilt-x')).toBe('');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

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

describe('HomePage published statistics', () => {
  it('always displays four statistics with zero values while counts are empty', () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    const section = screen.getByRole('region', { name: 'Ztalent Coder at a glance' });
    const cards = within(section).getAllByRole('article');

    expect(cards).toHaveLength(4);
    expect(cards.map((card) => card.textContent)).toEqual([
      '0Academic Courses',
      '0Published Projects',
      '0Services',
      '0Published Blog Articles',
    ]);
  });

  it('renders the latest API counts and singular labels', () => {
    usePublicContent.mockImplementation((resource) => ({
      data: resource === 'statistics'
        ? {
          statistics: [
            { key: 'academicCourses', value: 1, label: 'Academic Course' },
            { key: 'projects', value: 2, label: 'Published Projects' },
            { key: 'services', value: 0, label: 'Services' },
            { key: 'blogArticles', value: 1, label: 'Published Blog Article' },
          ],
        }
        : { items: resource === 'business-areas' ? areas : [] },
      status: 'success',
    }));

    render(<MemoryRouter><HomePage /></MemoryRouter>);
    const section = screen.getByRole('region', { name: 'Ztalent Coder at a glance' });
    expect(within(section).getAllByRole('article').map((card) => card.textContent)).toEqual([
      '1Academic Course',
      '2Published Projects',
      '0Services',
      '1Published Blog Article',
    ]);
  });
});
