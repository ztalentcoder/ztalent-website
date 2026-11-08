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

let hadCreateObjectUrl;
let hadRevokeObjectUrl;
let originalCreateObjectUrl;
let originalRevokeObjectUrl;

beforeEach(() => {
  vi.clearAllMocks();
  hadCreateObjectUrl = Object.hasOwn(URL, 'createObjectURL');
  hadRevokeObjectUrl = Object.hasOwn(URL, 'revokeObjectURL');
  originalCreateObjectUrl = URL.createObjectURL;
  originalRevokeObjectUrl = URL.revokeObjectURL;
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:home-intro') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  api.getCompanyProfile.mockResolvedValue({
    item: { id: 1, name: 'Ztalent Coder', logoUrl: null, homeIntroImageUrl: null },
  });
  api.listAdminContent.mockResolvedValue({ items: [] });
  api.uploadAdminImage.mockResolvedValue({
    url: '/uploads/images/company/123e4567-e89b-42d3-a456-426614174000.jpg',
  });
  api.updateCompanyProfile.mockImplementation(async (body) => ({
    item: { id: 1, name: 'Ztalent Coder', ...body },
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (hadCreateObjectUrl) {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectUrl });
  } else {
    delete URL.createObjectURL;
  }
  if (hadRevokeObjectUrl) {
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectUrl });
  } else {
    delete URL.revokeObjectURL;
  }
});

describe('Company Profile home intro image', () => {
  it('previews the default image and saves a replacement through the managed uploader', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(
      <MemoryRouter>
        <AdminContentPage resource="company-profile" />
      </MemoryRouter>,
    );

    const preview = await screen.findByAltText('Home intro image preview');
    expect(preview).toHaveAttribute('src', `${window.location.origin}/images/image1.jpg`);

    await user.upload(
      screen.getByLabelText('Home intro image'),
      new File(['image'], 'home-intro.jpg', { type: 'image/jpeg' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(api.updateCompanyProfile).toHaveBeenCalledWith(expect.objectContaining({
      homeIntroImageUrl: '/uploads/images/company/123e4567-e89b-42d3-a456-426614174000.jpg',
    })));
    expect(api.uploadAdminImage).toHaveBeenCalledWith(
      'company-profile',
      expect.objectContaining({ name: 'home-intro.jpg' }),
      expect.any(Function),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Company profile saved.');
  });
});
