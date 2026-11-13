// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import BlogPage from './BlogPage.jsx';

const mocks = vi.hoisted(() => ({ usePublicContent: vi.fn() }));
vi.mock('../../hooks/usePublicContent.js', () => ({ default: mocks.usePublicContent }));

let posts = [];
const categories = [
  { slug: 'data-ai', name: 'Data & AI', postCount: 2 },
  { slug: 'engineering', name: 'Engineering', postCount: 10 },
];
let postsStatus = 'success';
const routers = [];

function makePost(index, overrides = {}) {
  return {
    slug: `article-${index}`,
    title: `Article ${index}`,
    excerpt: `Summary ${index}`,
    body: `Body ${index}`,
    coverImageUrl: null,
    category: { slug: 'engineering', name: 'Engineering' },
    publishedAt: '2025-01-15T00:00:00.000Z',
    author: 'Ztalent Team',
    readingTimeMinutes: 4,
    ...overrides,
  };
}

function renderBlog(initialEntry = '/blog') {
  const router = createMemoryRouter([{ path: '/blog', element: <BlogPage /> }], { initialEntries: [initialEntry] });
  routers.push(router);
  return { router, ...render(<RouterProvider router={router} />) };
}

beforeEach(() => {
  posts = Array.from({ length: 12 }, (_, index) => makePost(index + 1));
  posts[0] = makePost(1, {
    isFeatured: true,
    coverImageUrl: '/uploads/images/blog/12345678-1234-4123-8123-123456789012.png',
  });
  posts[1] = makePost(2, { isFeatured: false });
  postsStatus = 'success';
  mocks.usePublicContent.mockReset();
  mocks.usePublicContent.mockImplementation((path, query = {}) => {
    if (path === 'blog-categories') {
      return { status: 'success', data: { items: categories }, retry: vi.fn() };
    }
    if (path === 'blog-posts') {
      let filtered = posts;
      if (query.category) filtered = filtered.filter((post) => post.category.slug === query.category);
      if (query.search) filtered = filtered.filter((post) => `${post.title} ${post.excerpt}`.toLowerCase().includes(query.search.toLowerCase()));
      const pageSize = query.pageSize ?? 9;
      const page = query.page ?? 1;
      return {
        status: postsStatus,
        data: {
          items: filtered.slice((page - 1) * pageSize, page * pageSize),
          pagination: { page, pageSize, total: filtered.length, pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)) },
        },
        error: postsStatus === 'error' ? 'The articles could not be loaded.' : '',
        retry: vi.fn(),
      };
    }
    throw new Error(`Unexpected request: ${path}`);
  });
});

afterEach(() => {
  cleanup();
  routers.splice(0).forEach((router) => router.dispose());
});

describe('BlogPage', () => {
  it('shows published articles in one list with metadata, cover fallbacks, and slug links', async () => {
    renderBlog();

    expect(await screen.findByRole('heading', { name: 'Blog', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText(/featured article/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Article 1' })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Article 2' })).toBeInTheDocument();

    const featuredCard = screen.getByRole('heading', { name: 'Article 1' }).closest('article');
    expect(within(featuredCard).getByRole('img', { name: 'Article 1' })).toBeInTheDocument();
    expect(within(featuredCard).getByRole('link', { name: 'Read Article' })).toHaveAttribute('href', '/blog/article-1');
    expect(within(featuredCard).getByText(/Ztalent Team.*4 min read/)).toBeInTheDocument();

    const regularCard = screen.getByRole('heading', { name: 'Article 2' }).closest('article');
    expect(within(regularCard).getByRole('img', { name: 'Article cover image unavailable' })).toBeInTheDocument();
    expect(within(regularCard).getByRole('link', { name: 'Read Article' })).toHaveAttribute('href', '/blog/article-2');
  });

  it('renders long titles and excerpts with a usable action when an article has no cover', async () => {
    const title = 'Building dependable digital products for teams working across multiple industries';
    const excerpt = 'A detailed editorial introduction about planning, research, accessible design, and dependable software delivery.';
    posts = [makePost(1, { slug: 'long-editorial-story', title, excerpt, coverImageUrl: null })];
    renderBlog();

    const heading = await screen.findByRole('heading', { name: title });
    const card = heading.closest('article');
    expect(within(card).getByText(excerpt)).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: 'Article cover image unavailable' })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Read Article' })).toHaveAttribute('href', '/blog/long-editorial-story');
  });

  it('syncs search, category filters, pagination, and browser history with URL queries', async () => {
    const user = userEvent.setup();
    const { router } = renderBlog();
    await screen.findAllByRole('heading', { name: 'Article 1' });

    await user.type(screen.getByRole('searchbox', { name: 'Search articles' }), 'Article 2');
    await user.click(screen.getByRole('button', { name: 'Search', exact: true }));
    await waitFor(() => expect(router.state.location.search).toBe('?search=Article+2'));
    expect(await screen.findByText('Article 2')).toBeInTheDocument();
    expect(mocks.usePublicContent).not.toHaveBeenCalledWith('blog-posts/featured');

    await user.click(screen.getByRole('button', { name: /Data & AI/ }));
    await waitFor(() => expect(router.state.location.search).toContain('category=data-ai'));
    expect(router.state.location.search).toContain('search=Article+2');

    await router.navigate('/blog?page=2');
    await waitFor(() => expect(mocks.usePublicContent).toHaveBeenCalledWith(
      'blog-posts',
      { page: 2, pageSize: 9 },
    ));
    await router.navigate(-1);
    await waitFor(() => expect(router.state.location.search).toContain('category=data-ai'));
  });

  it('renders loading, empty, and request-error states', async () => {
    posts = [];
    renderBlog();
    expect(await screen.findByText('There are no published articles yet.')).toBeInTheDocument();

    cleanup();
    postsStatus = 'error';
    renderBlog();
    expect(await screen.findByRole('alert')).toHaveTextContent('The articles could not be loaded.');
  });

  it('normalizes invalid and out-of-range page query values', async () => {
    const { router } = renderBlog('/blog?page=99');
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'));

    await router.navigate('/blog?page=0');
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });
});
