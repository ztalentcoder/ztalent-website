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

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
let projects;
const businessArea = { id: 'area-1', name: 'Data & AI', status: 'PUBLISHED' };

beforeEach(() => {
  vi.clearAllMocks();
  projects = [];
  api.listAdminContent.mockImplementation(async (resource) => ({
    items: resource === 'projects' ? projects : resource === 'business-areas' ? [businessArea] : [],
    pagination: { page: 1, total: projects.length, pageCount: 1 },
  }));
  api.createAdminContent.mockImplementation(async (_resource, body) => {
    const item = {
      id: 'project-1',
      slug: 'ztalent-coder-website',
      businessAreaId: null,
      ...body,
    };
    projects.push(item);
    return { item };
  });
  api.getAdminContent.mockImplementation(async (_resource, id) => ({
    item: projects.find((project) => project.id === id),
  }));
  api.updateAdminContent.mockImplementation(async (_resource, id, body) => {
    const index = projects.findIndex((project) => project.id === id);
    projects[index] = { ...projects[index], ...body };
    return { item: projects[index] };
  });
});

afterEach(() => {
  cleanup();
  if (originalCreateObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
  } else {
    delete URL.createObjectURL;
  }
  if (originalRevokeObjectURL) {
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
  } else {
    delete URL.revokeObjectURL;
  }
});

describe('Projects CMS editor', () => {
  it('creates and lists a published project without a Business Area or manual slug', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AdminContentPage resource="projects" /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Create Project' }));
    expect(screen.queryByLabelText('Business area')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Slug')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Project Title'), 'Ztalent Coder Website');
    await user.type(screen.getByLabelText('Short Summary'), 'A modern company website.');
    await user.type(screen.getByLabelText('Project Overview'), 'Project details.');
    await user.selectOptions(screen.getByLabelText('Publishing Status'), 'PUBLISHED');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.createAdminContent).toHaveBeenCalledWith('projects', expect.objectContaining({
        title: 'Ztalent Coder Website',
        summary: 'A modern company website.',
        description: 'Project details.',
        status: 'PUBLISHED',
      }));
    });
    const submitted = api.createAdminContent.mock.calls[0][1];
    expect(submitted).not.toHaveProperty('businessAreaId');
    expect(submitted).not.toHaveProperty('slug');
    expect(await screen.findByText('Ztalent Coder Website')).toBeInTheDocument();
  });

  it('retains the existing Business Area relationship when editing and keeps the existing slug out of the form', async () => {
    const user = userEvent.setup();
    projects.push({
      id: 'project-1',
      businessAreaId: businessArea.id,
      title: 'Existing project',
      slug: 'existing-project-url',
      summary: 'Existing summary.',
      description: 'Existing description.',
      imageUrl: null,
      status: 'DRAFT',
      sortOrder: 0,
    });
    render(<MemoryRouter><AdminContentPage resource="projects" /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const areaSelect = await screen.findByLabelText('Business area');
    expect(areaSelect).toHaveValue(businessArea.id);
    expect(screen.queryByLabelText('Slug')).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Project Title'));
    await user.type(screen.getByLabelText('Project Title'), 'Renamed project');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.updateAdminContent).toHaveBeenCalledWith('projects', 'project-1', expect.objectContaining({
        title: 'Renamed project',
        businessAreaId: businessArea.id,
      }));
    });
    expect(api.updateAdminContent.mock.calls[0][2]).not.toHaveProperty('slug');
    expect(projects[0].slug).toBe('existing-project-url');
  });

  it('creates ordered project features and uploads multiple gallery images with previews', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((file) => `blob:${file.name}`);
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    api.uploadAdminImage.mockImplementation(async (_resource, file) => ({
      url: `/uploads/images/projects/${file.name}`,
    }));
    render(<MemoryRouter><AdminContentPage resource="projects" /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Create Project' }));
    await user.type(screen.getByLabelText('Project Title'), 'Detailed project');
    await user.type(screen.getByLabelText('Short Summary'), 'A short project summary.');
    await user.type(screen.getByLabelText('Project Overview'), 'A detailed project overview.');
    await user.type(screen.getByLabelText('Problem Statement'), 'A real problem.');
    await user.type(screen.getByLabelText('Our Solution'), 'A clear solution.');
    await user.type(screen.getByLabelText('Project Outcome / Impact'), 'A positive outcome.');

    await user.click(screen.getByRole('button', { name: 'Add Feature' }));
    await user.type(screen.getByLabelText('Feature 1 title'), 'Feature one');
    await user.type(screen.getByLabelText('Feature 1 description'), 'First feature details.');
    await user.click(screen.getByRole('button', { name: 'Add Feature' }));
    await user.type(screen.getByLabelText('Feature 2 title'), 'Feature two');
    await user.type(screen.getByLabelText('Feature 2 description'), 'Second feature details.');
    await user.click(screen.getByRole('button', { name: 'Move feature 2 up' }));

    const files = [
      new File(['image one'], 'screen-one.png', { type: 'image/png' }),
      new File(['image two'], 'screen-two.webp', { type: 'image/webp' }),
    ];
    await user.upload(screen.getByLabelText('Add project gallery images'), files);
    expect(await screen.findByRole('img', { name: 'Project gallery image 1 preview' })).toHaveAttribute('src', 'blob:screen-one.png');
    expect(screen.getByRole('img', { name: 'Project gallery image 2 preview' })).toHaveAttribute('src', 'blob:screen-two.webp');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.createAdminContent).toHaveBeenCalledWith('projects', expect.objectContaining({
        description: 'A detailed project overview.',
        problemStatement: 'A real problem.',
        solution: 'A clear solution.',
        outcome: 'A positive outcome.',
        keyFeatures: [
          { title: 'Feature two', description: 'Second feature details.' },
          { title: 'Feature one', description: 'First feature details.' },
        ],
        galleryImages: [
          { imageUrl: '/uploads/images/projects/screen-one.png' },
          { imageUrl: '/uploads/images/projects/screen-two.webp' },
        ],
      }));
    });
    expect(api.uploadAdminImage).toHaveBeenCalledTimes(2);
    expect(api.uploadAdminImage).toHaveBeenNthCalledWith(1, 'projects', files[0], expect.any(Function));
    expect(api.uploadAdminImage).toHaveBeenNthCalledWith(2, 'projects', files[1], expect.any(Function));
  });

  it('preserves existing details and supports removing/reordering features and gallery images', async () => {
    const user = userEvent.setup();
    projects.push({
      id: 'project-1',
      businessAreaId: businessArea.id,
      title: 'Existing project',
      slug: 'existing-project-url',
      summary: 'Existing summary.',
      description: 'Existing overview.',
      problemStatement: 'Existing problem.',
      solution: 'Existing solution.',
      outcome: 'Existing outcome.',
      technologies: ['React'],
      keyFeatures: [
        { id: 'feature-1', title: 'First', description: 'First details.', sortOrder: 0 },
        { id: 'feature-2', title: 'Second', description: 'Second details.', sortOrder: 1 },
      ],
      galleryImages: [
        { id: 'image-1', imageUrl: '/uploads/images/projects/one.png', sortOrder: 0 },
        { id: 'image-2', imageUrl: '/uploads/images/projects/two.png', sortOrder: 1 },
      ],
      imageUrl: null,
      status: 'DRAFT',
      sortOrder: 0,
    });
    api.getAdminContent.mockImplementation(async (_resource, id) => ({
      item: projects.find((project) => project.id === id),
    }));
    render(<MemoryRouter><AdminContentPage resource="projects" /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByRole('img', { name: 'Project gallery image 1 preview' });
    await user.click(screen.getByRole('button', { name: 'Move feature 2 up' }));
    await user.click(screen.getByRole('button', { name: 'Move image 2 up' }));
    await user.click(screen.getByRole('button', { name: 'Remove image 2' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.updateAdminContent).toHaveBeenCalledWith('projects', 'project-1', expect.objectContaining({
        description: 'Existing overview.',
        problemStatement: 'Existing problem.',
        solution: 'Existing solution.',
        outcome: 'Existing outcome.',
        technologies: ['React'],
        businessAreaId: businessArea.id,
        keyFeatures: [
          { title: 'Second', description: 'Second details.' },
          { title: 'First', description: 'First details.' },
        ],
        galleryImages: [{ imageUrl: '/uploads/images/projects/two.png' }],
      }));
    });
    expect(api.updateAdminContent.mock.calls[0][2]).not.toHaveProperty('slug');
  });
});
