// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminLayout from './AdminLayout.jsx';

const auth = vi.hoisted(() => ({ useAdminAuth: vi.fn() }));
const api = vi.hoisted(() => ({ getAdminDashboard: vi.fn() }));

vi.mock('../context/AdminAuthContext.jsx', () => auth);
vi.mock('../services/adminContentApi.js', () => api);

function renderLayout({ path = '/admin/dashboard', role = 'SUPER_ADMIN' } = {}) {
  const logout = vi.fn().mockResolvedValue(undefined);
  auth.useAdminAuth.mockReturnValue({
    admin: { name: 'Amina Admin', role },
    logout,
  });
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<p>Dashboard content</p>} />
          <Route path="company-profile" element={<p>Company content</p>} />
          <Route path="tech-solutions" element={<p>Tech Solutions content</p>} />
          <Route path="manage/:resource" element={<p>Managed content</p>} />
          <Route path="login" element={<p>Login page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return { logout };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getAdminDashboard.mockResolvedValue({ counts: { newContactMessages: 0 } });
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('AdminLayout navigation', () => {
  it('uses the existing routes and expands only the active dropdown group', async () => {
    const user = userEvent.setup();
    renderLayout({ path: '/admin/manage/services' });

    const servicesGroup = screen.getByRole('button', { name: 'Services' });
    const websiteGroup = screen.getByRole('button', { name: 'Website Content' });
    expect(servicesGroup).toHaveAttribute('aria-expanded', 'true');
    expect(websiteGroup).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Data & AI' })).toHaveAttribute('href', '/admin/manage/services');
    expect(screen.getByRole('link', { name: 'Academic' })).toHaveAttribute('href', '/admin/manage/academic-courses');
    expect(screen.getByRole('link', { name: 'Tech Solutions' })).toHaveAttribute('href', '/admin/tech-solutions');

    await user.click(websiteGroup);
    expect(websiteGroup).toHaveAttribute('aria-expanded', 'true');
    expect(servicesGroup).toHaveAttribute('aria-expanded', 'false');
    await user.click(websiteGroup);
    expect(websiteGroup).toHaveAttribute('aria-expanded', 'false');

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin/dashboard');
    expect(screen.getByRole('link', { name: 'People' })).toHaveAttribute('href', '/admin/manage/team-members');
    expect(screen.getByRole('link', { name: /Inquiries/ })).toHaveAttribute('href', '/admin/manage/contact-messages');
    expect(screen.getByRole('button', { name: /Settings/ })).toBeDisabled();
    const navigation = within(screen.getByRole('navigation', { name: 'Admin navigation' }));
    const routes = navigation.getAllByRole('link', { hidden: true }).map((link) => link.getAttribute('href'));
    expect(routes).toEqual([
      '/admin/dashboard',
      '/admin/company-profile',
      '/admin/manage/about-page',
      '/admin/manage/site-statistics',
      '/admin/manage/academic-courses',
      '/admin/tech-solutions',
      '/admin/manage/services',
      '/admin/manage/projects',
      '/admin/manage/testimonials',
      '/admin/manage/blog-posts',
      '/admin/manage/blog-categories',
      '/admin/manage/team-members',
      '/admin/manage/contact-messages',
    ]);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('activates the dedicated Tech Solutions destination and closes mobile navigation after selecting it', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    renderLayout({ path: '/admin/tech-solutions' });
    const link = screen.getByRole('link', { name: 'Tech Solutions' });
    expect(link).toHaveAttribute('href', '/admin/tech-solutions');
    expect(link.className).toContain('activeSubmenuLink');
    expect(screen.getByRole('button', { name: 'Services' })).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Open admin navigation' }));
    await user.click(link);
    expect(await screen.findByText('Tech Solutions content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open admin navigation' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows unread counts only for super admins and hides a zero count', async () => {
    api.getAdminDashboard.mockResolvedValue({ counts: { newContactMessages: 4 } });
    renderLayout();
    const inquiries = await screen.findByRole('link', { name: 'Inquiries, 4 unread messages' });
    expect(inquiries).toHaveAttribute('href', '/admin/manage/contact-messages');
    expect(screen.getByText('4')).toBeInTheDocument();

    cleanup();
    api.getAdminDashboard.mockResolvedValue({ counts: { newContactMessages: 0 } });
    api.getAdminDashboard.mockClear();
    renderLayout({ role: 'EDITOR' });
    expect(screen.queryByRole('link', { name: /Inquiries/ })).not.toBeInTheDocument();
    expect(api.getAdminDashboard).not.toHaveBeenCalled();
  });

  it('keeps collapsed navigation operable and closes the mobile drawer after navigation', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('title', 'Dashboard');

    await user.click(screen.getByRole('button', { name: 'Open admin navigation' }));
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(screen.getByRole('link', { name: 'People' }));
    await waitFor(() => expect(screen.getByText('Managed content')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Open admin navigation' })).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.style.overflow).toBe('');
  });

  it('preserves the secure logout action in the sidebar', async () => {
    const user = userEvent.setup();
    const { logout } = renderLayout();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalledOnce();
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('refreshes the unread count after inquiry statuses change', async () => {
    renderLayout();
    await waitFor(() => expect(api.getAdminDashboard).toHaveBeenCalledOnce());
    api.getAdminDashboard.mockResolvedValue({ counts: { newContactMessages: 2 } });
    window.dispatchEvent(new Event('admin-contact-messages-updated'));
    expect(await screen.findByRole('link', { name: 'Inquiries, 2 unread messages' })).toBeInTheDocument();
    expect(api.getAdminDashboard).toHaveBeenCalledTimes(2);
  });
});
