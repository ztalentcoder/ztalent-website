// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as adminContentApi from '../../services/adminContentApi.js';
import AdminContentPage from './AdminContentPage.jsx';

vi.mock('../../services/adminContentApi.js', () => ({
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

const statisticRecords = [
  { id: 'projects', key: 'projects-delivered', label: 'Projects Delivered', description: 'Project count.', value: 0, sortOrder: 0, isActive: true },
  { id: 'institutions', key: 'institutions-served', label: 'Institutions Served', description: 'Institution count.', value: 12, sortOrder: 2, isActive: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  adminContentApi.listAdminContent.mockResolvedValue({
    items: statisticRecords,
    pagination: { page: 1, total: statisticRecords.length, pageCount: 1 },
  });
  adminContentApi.getAdminContent.mockImplementation(async (_resource, id) => ({
    item: statisticRecords.find((item) => item.id === id),
  }));
  adminContentApi.updateAdminContent.mockImplementation(async (_resource, id, data) => ({
    item: { ...statisticRecords.find((item) => item.id === id), ...data },
  }));
});

afterEach(cleanup);

describe('Site Statistics admin editor', () => {
  it('hides the value editor for automatic counts and preserves them on save', async () => {
    render(<MemoryRouter><AdminContentPage resource="site-statistics" /></MemoryRouter>);
    const row = await screen.findByRole('row', { name: /Projects Delivered/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));

    expect(await screen.findByLabelText('Statistic heading')).toHaveValue('Projects Delivered');
    expect(screen.queryByLabelText('Manual value')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Site statistic' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Supporting description'), {
      target: { value: 'New project description.' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form'));

    await waitFor(() => {
      expect(adminContentApi.updateAdminContent).toHaveBeenCalledWith(
        'site-statistics',
        'projects',
        expect.objectContaining({ description: 'New project description.' }),
      );
    });
    expect(adminContentApi.updateAdminContent.mock.calls[0][2]).not.toHaveProperty('value');
  });

  it('allows administrators to edit manually entered statistics values', async () => {
    render(<MemoryRouter><AdminContentPage resource="site-statistics" /></MemoryRouter>);
    const row = await screen.findByRole('row', { name: /Institutions Served/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));

    expect(await screen.findByLabelText('Manual value')).toHaveValue(12);
    fireEvent.change(screen.getByLabelText('Manual value'), { target: { value: '25' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form'));

    await waitFor(() => {
      expect(adminContentApi.updateAdminContent).toHaveBeenCalledWith(
        'site-statistics',
        'institutions',
        expect.objectContaining({ value: 25 }),
      );
    });
  });
});
