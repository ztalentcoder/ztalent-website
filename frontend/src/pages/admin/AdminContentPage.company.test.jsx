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
  patchAdminContent: vi.fn(),
  patchCompanyProfile: vi.fn(),
  updateAdminContent: vi.fn(),
  updateCompanyProfile: vi.fn(),
  updateContactMessageStatus: vi.fn(),
  uploadAdminImage: vi.fn(),
}));

vi.mock('../../services/adminContentApi.js', () => api);

let persistedProfile;
let persistedSocialLinks;
let hadCreateObjectUrl;
let hadRevokeObjectUrl;
let originalCreateObjectUrl;
let originalRevokeObjectUrl;

beforeEach(() => {
  vi.clearAllMocks();
  persistedProfile = {
    id: 1,
    name: 'Ztalent Coder',
    tagline: 'Existing tagline',
    description: 'Existing company description.',
    email: 'old@example.com',
    phone: '+255 600 000 000',
    location: 'Dar es Salaam',
    hours: 'Weekdays',
    logoUrl: null,
    homeIntroImageUrl: null,
  };
  persistedSocialLinks = [
    { id: 'instagram-id', platform: 'instagram', url: 'https://instagram.com/old', sortOrder: 0, isActive: true },
    { id: 'facebook-id', platform: 'facebook', url: 'https://facebook.com/ztalentcoder', sortOrder: 1, isActive: true },
  ];
  hadCreateObjectUrl = Object.hasOwn(URL, 'createObjectURL');
  hadRevokeObjectUrl = Object.hasOwn(URL, 'revokeObjectURL');
  originalCreateObjectUrl = URL.createObjectURL;
  originalRevokeObjectUrl = URL.revokeObjectURL;
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:home-intro') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  api.getCompanyProfile.mockImplementation(async () => ({ item: { ...persistedProfile } }));
  api.listAdminContent.mockImplementation(async (resource) => ({
    items: resource === 'company-profile/social-links' ? persistedSocialLinks.map((item) => ({ ...item })) : [],
  }));
  api.patchCompanyProfile.mockImplementation(async (body) => {
    persistedProfile = { ...persistedProfile, ...body };
    return { item: { ...persistedProfile } };
  });
  api.patchAdminContent.mockImplementation(async (_resource, id, body) => {
    persistedSocialLinks = persistedSocialLinks.map((item) => item.id === id ? { ...item, ...body } : item);
    return { item: persistedSocialLinks.find((item) => item.id === id) };
  });
  api.createAdminContent.mockImplementation(async (_resource, body) => {
    const item = { id: `${body.platform}-id`, companyProfileId: 1, sortOrder: 0, isActive: true, ...body };
    persistedSocialLinks = [...persistedSocialLinks, item];
    return { item };
  });
  api.updateAdminContent.mockImplementation(async (_resource, id, body) => {
    persistedSocialLinks = persistedSocialLinks.map((item) => item.id === id ? { ...item, ...body } : item);
    return { item: persistedSocialLinks.find((item) => item.id === id) };
  });
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

    await waitFor(() => expect(api.patchCompanyProfile).toHaveBeenCalledWith(expect.objectContaining({
      homeIntroImageUrl: '/uploads/images/company/123e4567-e89b-42d3-a456-426614174000.jpg',
    })));
    expect(api.uploadAdminImage).toHaveBeenCalledWith(
      'company-profile',
      expect.objectContaining({ name: 'home-intro.jpg' }),
      expect.any(Function),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Brand assets saved.');
  });
});

describe('Company Profile partial editing', () => {
  it('updates individual profile fields, preserves untouched data, reloads saved values, and patches one social link', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <MemoryRouter>
        <AdminContentPage resource="company-profile" />
      </MemoryRouter>,
    );

    await screen.findByDisplayValue('Ztalent Coder');
    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '+255 622 923 299');
    await user.click(screen.getByRole('button', { name: 'Save contact information' }));

    expect(api.patchCompanyProfile).toHaveBeenLastCalledWith({ phone: '+255 622 923 299' });
    expect(await screen.findByRole('status')).toHaveTextContent('Contact information saved.');
    expect(persistedProfile).toMatchObject({
      name: 'Ztalent Coder',
      tagline: 'Existing tagline',
      description: 'Existing company description.',
      email: 'old@example.com',
      phone: '+255 622 923 299',
      location: 'Dar es Salaam',
      hours: 'Weekdays',
    });

    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'ztalentcoder@gmail.com');
    await user.click(screen.getByRole('button', { name: 'Save contact information' }));
    expect(api.patchCompanyProfile).toHaveBeenLastCalledWith({ email: 'ztalentcoder@gmail.com' });
    expect(persistedProfile.phone).toBe('+255 622 923 299');

    await user.clear(screen.getByLabelText('Address / location'));
    await user.type(screen.getByLabelText('Address / location'), 'Zanzibar');
    await user.click(screen.getByRole('button', { name: 'Save contact information' }));
    expect(api.patchCompanyProfile).toHaveBeenLastCalledWith({ location: 'Zanzibar' });
    expect(persistedProfile.email).toBe('ztalentcoder@gmail.com');

    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '+255 622 923 300');
    await user.clear(screen.getByLabelText('Address / location'));
    await user.type(screen.getByLabelText('Address / location'), 'Stone Town, Zanzibar');
    await user.click(screen.getByRole('button', { name: 'Save contact information' }));
    expect(api.patchCompanyProfile).toHaveBeenLastCalledWith({
      phone: '+255 622 923 300',
      location: 'Stone Town, Zanzibar',
    });

    expect(screen.queryByRole('button', { name: 'Add social link' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Instagram URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Facebook URL')).toHaveValue('https://facebook.com/ztalentcoder');
    await user.clear(screen.getByLabelText('Instagram URL'));
    await user.type(screen.getByLabelText('Instagram URL'), 'https://www.instagram.com/ztalentcoder/');
    await user.click(screen.getByRole('button', { name: 'Save Instagram' }));
    expect(api.patchAdminContent).toHaveBeenCalledWith(
      'company-profile/social-links',
      'instagram-id',
      { url: 'https://www.instagram.com/ztalentcoder/' },
    );
    expect(persistedSocialLinks).toEqual([
      expect.objectContaining({ platform: 'instagram', url: 'https://www.instagram.com/ztalentcoder/' }),
      expect.objectContaining({ platform: 'facebook', url: 'https://facebook.com/ztalentcoder' }),
    ]);
    await user.type(screen.getByLabelText('WhatsApp URL'), 'https://wa.me/255622923299');
    await user.click(screen.getByRole('button', { name: 'Save WhatsApp' }));
    expect(api.createAdminContent).toHaveBeenCalledWith('company-profile/social-links', {
      platform: 'whatsapp',
      url: 'https://wa.me/255622923299',
      sortOrder: 2,
      isActive: true,
    });
    expect(persistedSocialLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ platform: 'facebook', url: 'https://facebook.com/ztalentcoder' }),
      expect.objectContaining({ platform: 'whatsapp', url: 'https://wa.me/255622923299' }),
    ]));

    unmount();
    render(
      <MemoryRouter>
        <AdminContentPage resource="company-profile" />
      </MemoryRouter>,
    );
    expect(await screen.findByDisplayValue('ztalentcoder@gmail.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+255 622 923 300')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Stone Town, Zanzibar')).toBeInTheDocument();
    expect(screen.getByLabelText('Instagram URL')).toHaveValue('https://www.instagram.com/ztalentcoder/');
    expect(screen.getByLabelText('WhatsApp URL')).toHaveValue('https://wa.me/255622923299');
  });

  it('lets contact fields and social links be saved when no company profile exists yet', async () => {
    const user = userEvent.setup();
    persistedProfile = null;
    persistedSocialLinks = [];
    api.getCompanyProfile.mockResolvedValueOnce({ item: null });
    api.patchCompanyProfile.mockResolvedValueOnce({
      item: { id: 1, name: 'Ztalent Coder', phone: '+255 622 900 000' },
    });
    render(
      <MemoryRouter>
        <AdminContentPage resource="company-profile" />
      </MemoryRouter>,
    );

    await screen.findByDisplayValue('ztalentcoder@gmail.com');
    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '+255 622 900 000');
    await user.click(screen.getByRole('button', { name: 'Save contact information' }));
    expect(api.patchCompanyProfile).toHaveBeenCalledWith({ phone: '+255 622 900 000' });

    await user.type(screen.getByLabelText('Instagram URL'), 'https://www.instagram.com/ztalentcoder/');
    await user.click(screen.getByRole('button', { name: 'Save Instagram' }));
    expect(api.createAdminContent).toHaveBeenCalledWith('company-profile/social-links', expect.objectContaining({
      platform: 'instagram',
      url: 'https://www.instagram.com/ztalentcoder/',
    }));
  });

  it('displays profile save errors and lets an administrator discard unsaved fields', async () => {
    const user = userEvent.setup();
    api.patchCompanyProfile.mockRejectedValueOnce(new Error('Profile update rejected.'));
    render(
      <MemoryRouter>
        <AdminContentPage resource="company-profile" />
      </MemoryRouter>,
    );

    await screen.findByDisplayValue('+255 600 000 000');
    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '+255 622 923 299');
    await user.click(screen.getByRole('button', { name: 'Save contact information' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Profile update rejected.');
    expect(screen.getByRole('button', { name: 'Save contact information' })).toBeEnabled();
    const contactForm = screen.getByRole('form', { name: 'Contact information' });
    await user.click(within(contactForm).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Phone')).toHaveValue('+255 600 000 000');
  });
});
