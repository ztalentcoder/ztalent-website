// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TechSolutionsPage from './TechSolutionsPage.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';

vi.mock('../../hooks/usePublicContent.js', () => ({ default: vi.fn() }));

const categories = [
  { slug: 'software-development', name: 'Software Development', summary: 'Digital products.' },
  { slug: 'it-services', name: 'IT Services', summary: 'Reliable support.' },
];
const services = [
  {
    slug: 'web-development',
    title: 'Web Development',
    summary: 'Modern websites.',
    icon: 'code',
    keyFeatures: ['Accessible interfaces'],
    businessArea: { slug: 'software-development', name: 'Software Development' },
  },
  {
    slug: 'it-consulting',
    title: 'IT Consulting',
    summary: 'Practical technology advice.',
    icon: 'settings',
    keyFeatures: [],
    businessArea: { slug: 'it-services', name: 'IT Services' },
  },
];

describe('Tech Solutions public catalogue', () => {
  beforeEach(() => {
    usePublicContent.mockReset();
  });

  afterEach(cleanup);

  it('groups icon-based published services under ordered dynamic categories', async () => {
    usePublicContent.mockImplementation((path) => ({
      status: 'success',
      data: { items: path === 'business-areas' ? categories : services },
      error: '',
      retry: vi.fn(),
    }));
    render(<MemoryRouter><TechSolutionsPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Software Development' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'IT Services' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Web Development' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'IT Consulting' })).toBeInTheDocument();
    expect(screen.getByText('Accessible interfaces')).toBeInTheDocument();
    expect(document.querySelectorAll('article img')).toHaveLength(0);
    expect(usePublicContent).toHaveBeenCalledWith('business-areas', { pageSize: 50 });
    expect(usePublicContent).toHaveBeenCalledWith('services', { pageSize: 50 });
  });

  it('shows recoverable loading, error, and empty states', async () => {
    const categoryRetry = vi.fn();
    const serviceRetry = vi.fn();
    usePublicContent.mockImplementation((path) => path === 'business-areas'
      ? { status: 'success', data: { items: [] }, error: '', retry: categoryRetry }
      : { status: 'error', data: null, error: 'Service catalogue unavailable.', retry: serviceRetry });
    const { rerender } = render(<MemoryRouter><TechSolutionsPage /></MemoryRouter>);

    expect(await screen.findByRole('alert')).toHaveTextContent('Service catalogue unavailable.');
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(categoryRetry).toHaveBeenCalledOnce();
    expect(serviceRetry).toHaveBeenCalledOnce();

    usePublicContent.mockImplementation((path) => ({
      status: 'success',
      data: { items: path === 'business-areas' ? categories : [] },
      error: '',
      retry: vi.fn(),
    }));
    rerender(<MemoryRouter><TechSolutionsPage /></MemoryRouter>);
    expect(await screen.findByText('There are no published services yet. Check back soon.')).toBeInTheDocument();
  });
});
