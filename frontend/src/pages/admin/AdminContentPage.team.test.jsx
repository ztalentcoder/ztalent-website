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

const member = {
  id: 'team-member-1',
  name: 'Ada Example',
  role: 'Lead Engineer',
  photoUrl: 'https://images.example.test/ada-landscape.webp',
  portfolioUrl: 'https://ada.example.test',
  photoPosition: 35,
  status: 'PUBLISHED',
  sortOrder: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listAdminContent.mockResolvedValue({ items: [member], pagination: { page: 1, total: 1, pageCount: 1 } });
  api.getAdminContent.mockResolvedValue({ item: member });
  api.updateAdminContent.mockImplementation(async (_resource, _id, body) => ({ item: { ...member, ...body } }));
});

afterEach(cleanup);

describe('Team Member crop editor', () => {
  it('updates the portrait preview and saves the vertical focal position', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AdminContentPage resource="team-members" /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const cropInput = await screen.findByLabelText('Portrait focal position (%)');
    const preview = screen.getByAltText('Profile photo preview');
    expect(preview.getAttribute('style')).toContain('object-position: center 35%');

    await user.clear(cropInput);
    await user.type(cropInput, '22');
    expect(preview.getAttribute('style')).toContain('object-position: center 22%');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updateAdminContent).toHaveBeenCalledWith(
      'team-members',
      member.id,
      expect.objectContaining({ photoPosition: 22 }),
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('Team member saved successfully.');
  });
});
