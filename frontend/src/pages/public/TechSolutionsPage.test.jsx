// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TechSolutionsPage from './TechSolutionsPage.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';

vi.mock('../../hooks/usePublicContent.js', () => ({ default: vi.fn() }));

const services = [
  {
    slug: 'web-development',
    title: 'Web Development',
    summary: 'Modern websites.',
    description: 'Full service description.',
    icon: 'code',
    keyFeatures: ['Accessible interfaces'],
    imageUrl: '/service.jpg',
  },
  {
    slug: 'it-consulting',
    title: 'IT Consulting',
    summary: 'Practical technology advice.',
    icon: 'settings',
  },
];

describe('Tech Solutions public catalogue', () => {
  beforeEach(() => {
    usePublicContent.mockReset();
  });

  afterEach(cleanup);

  it('renders dynamically loaded services as icon, title, and short-description cards', async () => {
    usePublicContent.mockReturnValue({
      status: 'success',
      data: { items: services },
      error: '',
      retry: vi.fn(),
    });
    render(<MemoryRouter><TechSolutionsPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Web Development' })).toBeInTheDocument();
    expect(screen.getByText('Modern websites.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'IT Consulting' })).toBeInTheDocument();
    expect(screen.getByText('Practical technology advice.')).toBeInTheDocument();
    expect(usePublicContent).toHaveBeenCalledOnce();
    expect(usePublicContent).toHaveBeenCalledWith('services', {
      pageSize: 50,
      businessArea: 'tech-solutions',
    });

    const serviceSection = screen.getByRole('heading', { name: 'Our Expertise' }).closest('section');
    expect(screen.getByText('We design and deliver innovative technology solutions that help businesses and organizations grow, operate efficiently, and achieve their goals.')).toBeInTheDocument();
    const cards = serviceSection.querySelectorAll('article');
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.querySelector('svg')).toBeInTheDocument();
      expect(card.querySelector('img, ul, ol')).toBeNull();
    }
    expect(screen.queryByText('Accessible interfaces')).not.toBeInTheDocument();
    expect(screen.queryByText('Full service description.')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Software Development' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Have a digital or data problem?' })).not.toBeInTheDocument();
  });

  it('shows recoverable error and empty states for the service feed', async () => {
    const retry = vi.fn();
    usePublicContent.mockReturnValue({
      status: 'error',
      data: null,
      error: 'Service catalogue unavailable.',
      retry,
    });
    const { rerender } = render(<MemoryRouter><TechSolutionsPage /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent('Service catalogue unavailable.');
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(retry).toHaveBeenCalledOnce();

    usePublicContent.mockReturnValue({
      status: 'success',
      data: { items: [] },
      error: '',
      retry: vi.fn(),
    });
    rerender(<MemoryRouter><TechSolutionsPage /></MemoryRouter>);
    expect(await screen.findByText('There are no published services yet. Check back soon.')).toBeInTheDocument();
  });
});
