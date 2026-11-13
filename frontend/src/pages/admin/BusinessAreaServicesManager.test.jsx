// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BusinessAreaServicesManager from './BusinessAreaServicesManager.jsx';

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

const areas = {
  academic: { id: 'area-academic', name: 'Academic', slug: 'academic' },
  'tech-solutions': { id: 'area-tech', name: 'Tech Solutions', slug: 'tech-solutions' },
  'data-ai': { id: 'area-data', name: 'Data & AI', slug: 'data-ai' },
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listAdminContent.mockImplementation((resource) => Promise.resolve({
    items: resource === 'business-areas' ? Object.values(areas) : [],
    pagination: { page: 1, total: 0, pageCount: 1 },
  }));
  api.createAdminContent.mockResolvedValue({ item: { id: 'created-id' } });
});

afterEach(cleanup);

describe('Business area management pages', () => {
  it.each(['tech-solutions', 'data-ai'])('scopes %s services to that Business Area', async (area) => {
    const user = userEvent.setup();
    const businessArea = areas[area];
    render(<BusinessAreaServicesManager area={area} />);

    expect(await screen.findByRole('heading', { name: businessArea.name })).toBeInTheDocument();
    await screen.findByText(/No (tech solutions|data & ai) services found/i);
    expect(api.listAdminContent).toHaveBeenCalledWith(
      'services',
      expect.objectContaining({ businessAreaId: businessArea.id }),
    );

    expect(screen.queryByLabelText('Business area')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Service Categories' })).not.toBeInTheDocument();
    expect(screen.queryByText('Category')).not.toBeInTheDocument();
  });

  it('creates Tech Solutions services with only the allowed fields and a fixed business area', async () => {
    const user = userEvent.setup();
    const businessArea = areas['tech-solutions'];
    render(<BusinessAreaServicesManager area="tech-solutions" />);

    await user.click(await screen.findByRole('button', { name: 'Create Service' }));
    expect(screen.getByLabelText('Service Name')).toBeRequired();
    expect(screen.getByLabelText('Short Description')).toBeRequired();
    expect(screen.getByLabelText('Service icon')).toBeRequired();
    expect(screen.getByLabelText('Service icon').closest('label').querySelector('svg')).toBeInTheDocument();
    expect(screen.getByLabelText('Publication status')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort order')).toBeInTheDocument();
    expect(screen.queryByLabelText(/category/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Business area')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/key features/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/image/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Service Name'), 'Web Development');
    await user.type(screen.getByLabelText('Short Description'), 'Modern websites.');
    await user.selectOptions(screen.getByLabelText('Service icon'), 'code');
    await user.selectOptions(screen.getByLabelText('Publication status'), 'PUBLISHED');
    await user.type(screen.getByLabelText('Sort order'), '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.createAdminContent).toHaveBeenCalledWith(
        'services',
        expect.objectContaining({
          businessAreaId: businessArea.id,
          serviceCategoryId: null,
          title: 'Web Development',
          summary: 'Modern websites.',
          icon: 'code',
          status: 'PUBLISHED',
          sortOrder: 1,
        }),
        { businessAreaId: businessArea.id },
      );
    });
    expect(api.createAdminContent.mock.calls[0][1]).not.toHaveProperty('description');
    expect(api.createAdminContent.mock.calls[0][1]).not.toHaveProperty('imageUrl');
    expect(api.createAdminContent.mock.calls[0][1]).not.toHaveProperty('keyFeatures');
  });

  it('creates Data & AI services with only the allowed fields and a fixed business area', async () => {
    const user = userEvent.setup();
    const businessArea = areas['data-ai'];
    render(<BusinessAreaServicesManager area="data-ai" />);

    await user.click(await screen.findByRole('button', { name: 'Create Service' }));
    expect(screen.queryByLabelText('Business area')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/category/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/image/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Service Name'), 'Data Analysis');
    await user.type(screen.getByLabelText('Short Description'), 'Actionable data insights.');
    await user.selectOptions(screen.getByLabelText('Service icon'), 'database');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.createAdminContent).toHaveBeenCalledWith(
        'services',
        expect.objectContaining({
          businessAreaId: businessArea.id,
          title: 'Data Analysis',
          summary: 'Actionable data insights.',
          icon: 'database',
        }),
        { businessAreaId: businessArea.id },
      );
    });
    expect(api.createAdminContent.mock.calls[0][1]).not.toHaveProperty('imageUrl');
    expect(api.createAdminContent.mock.calls[0][1]).not.toHaveProperty('serviceCategoryId');
  });

  it('keeps Academic services and service categories separate from the independent course catalogue', async () => {
    const user = userEvent.setup();
    render(<BusinessAreaServicesManager area="academic" />);

    expect(await screen.findByRole('heading', { name: 'Academic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Services' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Service Categories' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Courses' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Course Categories' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Courses' }));
    expect(await screen.findByRole('heading', { name: 'Academic Courses' })).toBeInTheDocument();
    await waitFor(() => {
      expect(api.listAdminContent).toHaveBeenCalledWith(
        'academic-courses',
        expect.objectContaining({ page: 1, pageSize: 10 }),
      );
    });
  });

  it('resolves the existing Academic area when its legacy name and slug differ', async () => {
    api.listAdminContent.mockImplementation((resource) => Promise.resolve({
      items: resource === 'business-areas'
        ? [
          areas['tech-solutions'],
          areas['data-ai'],
          { id: 'legacy-academic', name: 'Tcademic', slug: 'jj' },
        ]
        : [],
      pagination: { page: 1, total: 0, pageCount: 1 },
    }));

    render(<BusinessAreaServicesManager area="academic" />);

    expect(await screen.findByRole('heading', { name: 'Academic' })).toBeInTheDocument();
    await waitFor(() => {
      expect(api.listAdminContent).toHaveBeenCalledWith(
        'services',
        expect.objectContaining({ businessAreaId: 'legacy-academic' }),
      );
    });
  });
});
