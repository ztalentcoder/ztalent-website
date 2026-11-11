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
  api.listAdminContent.mockResolvedValue({
    items: [{ id: 'area-1', name: 'Software Development', slug: 'software-development', status: 'PUBLISHED' }],
    pagination: { page: 1, total: 1, pageCount: 1 },
  });
  api.createAdminContent.mockResolvedValue({ item: { id: 'service-1' } });
});

afterEach(cleanup);

describe('Services CMS editor', () => {
  it('supports dynamic categories, safe icon previews, key features, and publication states', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AdminContentPage resource="services" /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Create Service' }));
    await user.selectOptions(await screen.findByLabelText('Category'), 'area-1');
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
        title: 'Web Development',
        icon: 'brain',
        keyFeatures: ['Accessible interfaces', 'Responsive layouts'],
        status: 'PUBLISHED',
      }));
    });
    expect(api.createAdminContent.mock.calls[0][1]).not.toHaveProperty('slug');
  });
});
