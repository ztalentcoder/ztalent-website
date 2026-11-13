// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminContentPage from './AdminContentPage.jsx';

const api = vi.hoisted(() => ({
  createAdminContent: vi.fn(),
  deleteAdminContent: vi.fn(),
  deleteAdminImage: vi.fn(),
  getAdminContent: vi.fn(),
  getCompanyProfile: vi.fn(),
  listAdminContent: vi.fn(),
  updateAdminContent: vi.fn(),
  updateCompanyProfile: vi.fn(),
  updateContactMessageStatus: vi.fn(),
  uploadAdminImage: vi.fn(),
}));

vi.mock('../../services/adminContentApi.js', () => api);

beforeEach(() => {
  vi.clearAllMocks();
  api.listAdminContent.mockImplementation((resource) => Promise.resolve({
    items: resource === 'business-areas'
      ? [{ id: 'area-1', name: 'Tech Solutions', slug: 'tech-solutions', status: 'PUBLISHED' }]
      : resource === 'service-categories'
        ? [{ id: 'category-1', name: 'Software Development', businessAreaId: 'area-1', status: 'PUBLISHED' }]
        : [],
    pagination: { page: 1, total: resource === 'business-areas' ? 1 : 0, pageCount: 1 },
  }));
  api.createAdminContent.mockResolvedValue({ item: { id: 'service-1' } });
});

afterEach(cleanup);

describe('Services CMS editor', () => {
  it('assigns a business area and its scoped category with safe icons and publication states', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AdminContentPage resource="services" /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Create Service' }));
    const categorySelect = await screen.findByLabelText(/^Category \(optional\)/);
    expect(categorySelect).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Business area'), 'area-1');
    expect(categorySelect).toBeEnabled();
    await user.selectOptions(categorySelect, 'category-1');
    await user.type(screen.getByLabelText('Title'), 'Web Development');
    await user.type(screen.getByLabelText('Short description'), 'Modern websites for teams.');
    await user.type(screen.getByLabelText('Description'), 'Design and build responsive web applications.');
    await user.selectOptions(screen.getByLabelText('Service icon'), 'brain');
    await user.type(screen.getByLabelText(/Key features \(one per line\)/), 'Accessible interfaces\nResponsive layouts');
    await user.selectOptions(screen.getByLabelText('Publication status'), 'PUBLISHED');

    expect(screen.getByLabelText('Service icon').closest('label').querySelector('svg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.createAdminContent).toHaveBeenCalledWith('services', expect.objectContaining({
        businessAreaId: 'area-1',
        serviceCategoryId: 'category-1',
        title: 'Web Development',
        icon: 'brain',
        keyFeatures: ['Accessible interfaces', 'Responsive layouts'],
        status: 'PUBLISHED',
      }));
    });
    expect(api.createAdminContent.mock.calls[0][1]).not.toHaveProperty('slug');
  });
});
