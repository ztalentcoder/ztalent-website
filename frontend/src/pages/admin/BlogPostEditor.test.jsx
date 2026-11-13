// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminContentPage from './AdminContentPage.jsx';

const mocks = vi.hoisted(() => ({
  createAdminContent: vi.fn(),
  listAdminContent: vi.fn(),
}));

vi.mock('../../services/adminContentApi.js', () => ({
  createAdminContent: mocks.createAdminContent,
  deleteAdminContent: vi.fn(),
  deleteAdminImage: vi.fn(),
  getAdminContent: vi.fn(),
  getCompanyProfile: vi.fn(),
  listAdminContent: mocks.listAdminContent,
  patchAdminContent: vi.fn(),
  patchCompanyProfile: vi.fn(),
  updateAdminContent: vi.fn(),
  updateContactMessageStatus: vi.fn(),
  uploadAdminImage: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('admin blog post editor', () => {
  it('generates a URL-friendly slug from the title and permits an explicit slug override', async () => {
    const user = userEvent.setup();
    mocks.listAdminContent.mockResolvedValue({
      items: [{ id: 'category-1', name: 'Data & AI', slug: 'data-ai' }],
      pagination: { page: 1, total: 1, pageCount: 1 },
    });
    mocks.createAdminContent.mockResolvedValue({ item: { id: 'post-1' } });

    render(
      <MemoryRouter>
        <AdminContentPage resource="blog-posts" />
      </MemoryRouter>,
    );

    await screen.findByRole('columnheader', { name: 'Read time (min)' });
    expect(screen.queryByRole('columnheader', { name: 'Featured' })).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Create Blog post' }));
    expect(screen.queryByRole('checkbox', { name: 'Featured article' })).not.toBeInTheDocument();
    const title = screen.getByLabelText('Title');
    const slug = screen.getByLabelText('Slug (generated from title; editable)');
    await user.type(title, 'Ztalent Coder Website');
    expect(slug).toHaveValue('ztalent-coder-website');

    await user.clear(slug);
    await user.type(slug, 'custom-article-url');
    await user.clear(title);
    await user.type(title, 'A New Article');
    expect(slug).toHaveValue('custom-article-url');

    await user.selectOptions(screen.getByLabelText('Category'), 'category-1');
    await user.type(screen.getByLabelText('Article content in Markdown'), '## Article body');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.createAdminContent).toHaveBeenCalledWith(
      'blog-posts',
      expect.objectContaining({
        title: 'A New Article',
        slug: 'custom-article-url',
        categoryId: 'category-1',
        body: '## Article body',
      }),
    ));
    expect(mocks.createAdminContent.mock.calls[0][1]).not.toHaveProperty('isFeatured');
  });
});
