// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

const businessArea = {
  id: 'business-area-1',
  name: 'Data systems',
  slug: 'data-systems',
  description: 'Data engineering',
  status: 'DRAFT',
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listAdminContent.mockResolvedValue({
    items: [businessArea],
    pagination: { page: 1, total: 1, pageCount: 1 },
  });
  api.deleteAdminContent.mockResolvedValue({ status: 'success' });
});

afterEach(cleanup);

describe('CMS delete confirmation', () => {
  it('only deletes after confirmation and preserves the cancel action', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AdminContentPage resource="business-areas" /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('dialog', { name: 'Delete service category?' })).toBeInTheDocument();
    expect(api.deleteAdminContent).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.deleteAdminContent).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.deleteAdminContent).toHaveBeenCalledWith('business-areas', businessArea.id));
    expect(await screen.findByRole('status')).toHaveTextContent('Service category deleted.');
  });
});
