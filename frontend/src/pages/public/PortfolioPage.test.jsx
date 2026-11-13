// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import PublicContentDetailPage from './PublicContentDetailPage.jsx';
import PortfolioPage from './PortfolioPage.jsx';

const mocks = vi.hoisted(() => ({ usePublicContent: vi.fn() }));

vi.mock('../../hooks/usePublicContent.js', () => ({
  default: mocks.usePublicContent,
}));

let projectRecords = [];
let detailItem = null;
let detailStatus = 'success';
const routers = [];

function makeProject(number, overrides = {}) {
  return {
    slug: `project-${number}`,
    title: `Project ${number}`,
    summary: `Description for project ${number}.`,
    imageUrl: `https://images.example.test/project-${number}.jpg`,
    businessArea: { name: 'Technology' },
    ...overrides,
  };
}

function renderPortfolio(initialEntries = ['/portfolio']) {
  const router = createMemoryRouter([
    { path: '/portfolio', element: <PortfolioPage /> },
    { path: '/portfolio/:slug', element: <PublicContentDetailPage type="project" /> },
  ], { initialEntries });
  routers.push(router);
  return { router, ...render(<RouterProvider router={router} />) };
}

describe('PortfolioPage', () => {
  beforeEach(() => {
    projectRecords = Array.from({ length: 13 }, (_, index) => makeProject(index + 1));
    detailItem = null;
    detailStatus = 'success';
    mocks.usePublicContent.mockReset();
    mocks.usePublicContent.mockImplementation((path, query = {}) => {
      if (path === 'projects') {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 6;
        return {
          status: 'success',
          data: {
            items: projectRecords.slice((page - 1) * pageSize, page * pageSize),
            pagination: {
              page,
              pageSize,
              total: projectRecords.length,
              pageCount: Math.ceil(projectRecords.length / pageSize),
            },
          },
          retry: vi.fn(),
        };
      }
      if (path.startsWith('projects/')) {
        return {
          status: detailStatus,
          data: detailItem ? { item: detailItem } : null,
          error: 'The requested content could not be loaded.',
          errorStatus: detailStatus === 'error' ? 404 : null,
          retry: vi.fn(),
        };
      }
      if (path === 'testimonials') {
        return { status: 'success', data: { items: [] }, retry: vi.fn() };
      }
      throw new Error(`Unexpected public content request: ${path}`);
    });
  });

  afterEach(() => {
    cleanup();
    routers.splice(0).forEach((router) => router.dispose());
  });

  it('shows the hero and separate projects introduction in order without category filters', async () => {
    renderPortfolio();

    const heroHeading = await screen.findByRole('heading', { name: 'Our Projects', level: 1 });
    expect(screen.getByText('A selection of published projects delivered by our team.')).toBeInTheDocument();
    const introHeading = screen.getByRole('heading', { name: 'Turning Ideas Into Impactful Solutions.', level: 2 });
    expect(screen.getByText(
      'Explore some of the projects we have designed, developed, and delivered through technology and innovation.',
    )).toBeInTheDocument();
    const heroSection = heroHeading.closest('section');
    const introSection = introHeading.closest('section');
    expect(introSection).not.toBe(heroSection);
    expect(heroSection.compareDocumentPosition(introSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(heroSection).queryByRole('heading', { name: 'Turning Ideas Into Impactful Solutions.' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filter projects' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();
    expect(mocks.usePublicContent).not.toHaveBeenCalledWith('business-areas', expect.anything());
  });

  it('renders ordered project information and an accessible fallback for missing or failed images', async () => {
    projectRecords = [
      makeProject(1, { imageUrl: null }),
      makeProject(2, { businessArea: null }),
    ];
    renderPortfolio();

    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Project 1');
    expect(cards[0]).toHaveTextContent('Description for project 1.');
    expect(cards[0]).toHaveTextContent('Technology');
    expect(within(cards[0]).getByRole('link', { name: /View Project/ })).toHaveAttribute('href', '/portfolio/project-1');
    expect(screen.getByRole('img', { name: 'Project 1 project cover image unavailable' })).toBeInTheDocument();

    const image = screen.getByRole('img', { name: 'Project 2 project' });
    expect(cards[1]).not.toHaveTextContent('Technology');
    fireEvent.error(image);
    expect(screen.getByRole('img', { name: 'Project 2 project cover image unavailable' })).toBeInTheDocument();
    expect(screen.getAllByText('View Project')).toHaveLength(2);
  });

  it('requests exactly six projects and hides pagination for six or fewer', async () => {
    projectRecords = Array.from({ length: 6 }, (_, index) => makeProject(index + 1));
    renderPortfolio();

    expect(await screen.findAllByRole('article')).toHaveLength(6);
    expect(mocks.usePublicContent).toHaveBeenCalledWith('projects', { page: 1, pageSize: 6 });
    expect(screen.queryByRole('navigation', { name: 'Project pagination' })).not.toBeInTheDocument();
  });

  it('shows numbered pagination with correct active and disabled controls when there are more than six projects', async () => {
    projectRecords = Array.from({ length: 7 }, (_, index) => makeProject(index + 1));
    renderPortfolio();

    expect(await screen.findByRole('navigation', { name: 'Project pagination' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('initializes from the page query and updates URLs with numbered, Previous, and Next navigation', async () => {
    const user = userEvent.setup();
    const { router } = renderPortfolio(['/portfolio?page=2']);

    expect(await screen.findByText('Project 7')).toBeInTheDocument();
    expect(mocks.usePublicContent).toHaveBeenCalledWith('projects', { page: 2, pageSize: 6 });
    expect(router.state.location.search).toBe('?page=2');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(router.state.location.search).toBe('?page=3'));
    expect(await screen.findByText('Project 13')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'));
    expect(await screen.findByText('Project 7')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByText('Project 1')).toBeInTheDocument();
  });

  it('supports browser Back and Forward navigation between pages', async () => {
    const user = userEvent.setup();
    const { router } = renderPortfolio();
    await screen.findByText('Project 1');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(router.state.location.search).toBe('?page=3'));

    await router.navigate(-1);
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'));
    expect(await screen.findByText('Project 7')).toBeInTheDocument();

    await router.navigate(1);
    await waitFor(() => expect(router.state.location.search).toBe('?page=3'));
    expect(await screen.findByText('Project 13')).toBeInTheDocument();
  });

  it('normalizes invalid page values and clamps out-of-range pages to the last available page', async () => {
    const invalid = renderPortfolio(['/portfolio?page=0']);
    await screen.findByText('Project 1');
    await waitFor(() => expect(invalid.router.state.location.search).toBe(''));

    invalid.router.dispose();
    routers.pop();
    cleanup();

    const outOfRange = renderPortfolio(['/portfolio?page=99']);
    await waitFor(() => expect(outOfRange.router.state.location.search).toBe('?page=3'));
    expect(await screen.findByText('Project 13')).toBeInTheDocument();
  });

  it('recalculates the last valid page when the published project count drops', async () => {
    projectRecords = Array.from({ length: 7 }, (_, index) => makeProject(index + 1));
    const { router } = renderPortfolio(['/portfolio?page=3']);

    await waitFor(() => expect(router.state.location.search).toBe('?page=2'));
    expect(await screen.findByText('Project 7')).toBeInTheDocument();
  });

  it('links to dynamic project details and preserves the listing page when returning', async () => {
    const user = userEvent.setup();
    detailItem = makeProject(7, { description: 'Full project details.' });
    const { router } = renderPortfolio(['/portfolio?page=2']);

    await screen.findByText('Project 7');
    await user.click(screen.getAllByRole('link', { name: /View Project/ })[0]);

    expect(router.state.location.pathname).toBe('/portfolio/project-7');
    expect(router.state.location.search).toBe('?page=2');
    expect(await screen.findByRole('heading', { name: 'Project 7', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Full project details.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the Portfolio' })).toHaveAttribute('href', '/portfolio?page=2');
  });

  it('shows the project not-found state for an unavailable direct detail URL', async () => {
    detailStatus = 'error';
    const { router } = renderPortfolio(['/portfolio/unknown-project']);

    expect(await screen.findByRole('heading', { name: 'Project not found' })).toBeInTheDocument();
    expect(screen.getByText('This published content is unavailable.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/portfolio/unknown-project');
  });

  it('uses the approved CTA copy and Contact route', async () => {
    renderPortfolio();

    expect(await screen.findByRole('heading', { name: 'Have a Project in Mind?' })).toBeInTheDocument();
    expect(screen.getByText("Let's work together to turn your ideas into reality.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact Us' })).toHaveAttribute('href', '/contact');
  });
});
