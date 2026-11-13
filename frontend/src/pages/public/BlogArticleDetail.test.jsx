// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicContentDetailPage from './PublicContentDetailPage.jsx';

const mock = vi.hoisted(() => ({ result: null }));
vi.mock('../../hooks/usePublicContent.js', () => ({ default: () => mock.result }));

const article = {
  slug: 'building-with-data',
  title: 'Building with Data',
  excerpt: 'A practical introduction.',
  body: '## A clear approach\n\nUse **reliable data** and [read more](https://example.test/guide).\n\n<script>alert(1)</script>',
  coverImageUrl: '/uploads/images/blog/12345678-1234-4123-8123-123456789012.png',
  coverImageAlt: 'A data dashboard',
  author: 'Ztalent Editorial',
  publishedAt: '2025-02-01T00:00:00.000Z',
  updatedAt: '2025-02-02T00:00:00.000Z',
  readingTimeMinutes: 5,
  category: { name: 'Data & AI' },
  seoTitle: 'Building with Data | Guide',
  metaDescription: 'A useful guide to building with data.',
  relatedPosts: [{ slug: 'another-guide', title: 'Another Guide', excerpt: 'Related story.' }],
};

function renderArticle() {
  return render(
    <MemoryRouter initialEntries={['/blog/building-with-data']}>
      <Routes>
        <Route path="/blog/:slug" element={<PublicContentDetailPage type="article" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mock.result = { status: 'success', data: { item: article }, retry: vi.fn() };
});

afterEach(() => {
  cleanup();
  document.head.querySelector('#blog-article-structured-data')?.remove();
  document.head.querySelector('meta[property="og:title"]')?.remove();
  document.head.querySelector('meta[property="og:description"]')?.remove();
  document.head.querySelector('meta[property="og:type"]')?.remove();
  document.head.querySelector('meta[property="og:image"]')?.remove();
});

describe('public blog article details', () => {
  it('renders article metadata, safe Markdown, related articles, contact CTA, and SEO metadata', async () => {
    renderArticle();

    expect(await screen.findByRole('heading', { name: 'Building with Data', level: 1 })).toBeInTheDocument();
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb.querySelector('li[aria-current="page"]')).toHaveTextContent('Building with Data');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(breadcrumb.querySelector('a[href="/blog"]')).toHaveTextContent('Blog');
    expect(screen.getByRole('link', { name: 'Back to the Blog' })).toHaveAttribute('href', '/blog');
    expect(screen.getByText('Data & AI')).toBeInTheDocument();
    expect(screen.getByText('A practical introduction.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'A data dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A clear approach' })).toBeInTheDocument();
    expect(screen.getByText('reliable data')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'read more' })).toHaveAttribute('rel', 'noreferrer');
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(document.body.querySelector('script')).not.toBeInTheDocument();
    expect(screen.getByText('By Ztalent Editorial')).toBeInTheDocument();
    expect(screen.getByText('5 min read')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Related Articles' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact Us' })).toHaveAttribute('href', '/contact');
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute('content', 'Building with Data | Guide');
    expect(document.querySelector('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    expect(document.querySelector('#blog-article-structured-data')).toHaveTextContent('"@type":"BlogPosting"');
  });

  it('hides optional article sections and displays a fallback for a failed cover image', async () => {
    mock.result = {
      status: 'success',
      data: {
        item: {
          ...article,
          excerpt: '',
          body: '',
          coverImageUrl: '/uploads/images/blog/12345678-1234-4123-8123-123456789012.png',
          coverImageAlt: '',
          author: '',
          publishedAt: null,
          updatedAt: null,
          readingTimeMinutes: null,
          relatedPosts: [],
        },
      },
    };
    renderArticle();

    expect(await screen.findByRole('heading', { name: 'Building with Data', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Related Articles' })).not.toBeInTheDocument();
    expect(screen.queryByText(/min read/)).not.toBeInTheDocument();
    fireEvent.error(screen.getByRole('img', { name: 'Building with Data' }));
    expect(await screen.findByRole('img', { name: 'Article cover image unavailable' })).toBeInTheDocument();
  });

  it('renders long titles and rich Markdown when no cover image is available', async () => {
    const longTitle = 'Designing resilient systems for teams building products across many platforms';
    mock.result = {
      status: 'success',
      data: {
        item: {
          ...article,
          title: longTitle,
          coverImageUrl: null,
          body: [
            '## A readable section',
            '',
            'A paragraph with useful detail.',
            '',
            '- First item',
            '- Second item',
            '',
            '> A highlighted thought.',
            '',
            '![Inline chart](/uploads/images/blog/inline-chart.png)',
          ].join('\n'),
        },
      },
    };
    renderArticle();

    expect(await screen.findByRole('heading', { name: longTitle, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A readable section' })).toBeInTheDocument();
    expect(screen.getByText('First item')).toBeInTheDocument();
    expect(screen.getByRole('blockquote')).toHaveTextContent('A highlighted thought.');
    expect(screen.getByRole('img', { name: 'Inline chart' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: longTitle })).not.toBeInTheDocument();
  });
});
