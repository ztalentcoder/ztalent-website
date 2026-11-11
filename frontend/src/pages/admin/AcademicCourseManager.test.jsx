// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AcademicCourseManager from './AcademicCourseManager.jsx';
import {
  createAdminContent,
  createCourseEpisode,
  listAdminContent,
  listCourseEpisodes,
} from '../../services/adminContentApi.js';

vi.mock('../../services/adminContentApi.js', () => ({
  createAdminContent: vi.fn(),
  createCourseEpisode: vi.fn(),
  deleteAdminContent: vi.fn(),
  deleteAdminImage: vi.fn(),
  deleteCourseEpisode: vi.fn(),
  listAdminContent: vi.fn(),
  listCourseEpisodes: vi.fn(),
  reorderCourseEpisodes: vi.fn(),
  updateAdminContent: vi.fn(),
  updateCourseEpisode: vi.fn(),
  uploadAdminImage: vi.fn(),
}));

const category = {
  id: '123e4567-e89b-42d3-a456-426614174001',
  name: 'Web Development',
  slug: 'web-development',
  status: 'PUBLISHED',
  sortOrder: 0,
};

let savedCourses;

describe('Academic course management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savedCourses = [];
    listAdminContent.mockImplementation(async (resource) => (
      resource === 'course-categories'
        ? { items: [category] }
        : { items: savedCourses, pagination: { pageCount: 1, total: savedCourses.length } }
    ));
    listCourseEpisodes.mockResolvedValue({ items: [] });
    createAdminContent.mockImplementation(async (_resource, body) => {
      const item = { id: 'course-id', ...body, category, _count: { episodes: 0 } };
      savedCourses = [item];
      return { item };
    });
    createCourseEpisode.mockResolvedValue({ item: { id: 'episode-id' } });
  });

  afterEach(() => cleanup());

  it('creates a course and adds a YouTube episode in the same management workflow', async () => {
    const user = userEvent.setup();
    render(<AcademicCourseManager />);

    await screen.findByRole('option', { name: 'Web Development' });
    await user.click(screen.getByRole('button', { name: 'Create course' }));
    await user.type(screen.getByLabelText('Title'), 'Practical Web Development');
    expect(screen.getByLabelText(/^Slug/)).toHaveValue('practical-web-development');
    await user.selectOptions(screen.getAllByLabelText('Category').at(-1), category.id);
    await user.type(screen.getByLabelText('Full description'), 'Learn to build web applications.');
    await user.click(screen.getAllByRole('button', { name: 'Create course' }).at(-1));

    await screen.findByText('Practical Web Development');
    expect(await screen.findByText('Course created successfully.')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/no episodes yet/i)).not.toBeInTheDocument();
    expect(createAdminContent).toHaveBeenCalledWith('academic-courses', expect.objectContaining({
      title: 'Practical Web Development',
      slug: 'practical-web-development',
      courseCategoryId: category.id,
      description: 'Learn to build web applications.',
    }));

    await user.click(screen.getByRole('button', { name: 'Manage Episodes' }));
    expect(await screen.findByRole('dialog', { name: 'Episodes for Practical Web Development' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add episode' }));
    await user.type(screen.getByLabelText('Episode title'), 'HTML foundations');
    await user.type(screen.getByLabelText('YouTube URL'), 'https://youtu.be/abcdefghijk');
    await user.click(screen.getByRole('button', { name: 'Save episode' }));

    await waitFor(() => expect(createCourseEpisode).toHaveBeenCalledWith('course-id', expect.objectContaining({
      title: 'HTML foundations',
      youtubeUrl: 'https://youtu.be/abcdefghijk',
      status: 'DRAFT',
    })));
  });

  it('keeps failed course actions visible instead of showing a success message', async () => {
    const user = userEvent.setup();
    createAdminContent.mockRejectedValueOnce(new Error('Course save failed.'));
    render(<AcademicCourseManager />);

    await screen.findByRole('option', { name: 'Web Development' });
    await user.click(screen.getByRole('button', { name: 'Create course' }));
    await user.type(screen.getByLabelText('Title'), 'Course That Fails');
    await user.selectOptions(screen.getAllByLabelText('Category').at(-1), category.id);
    await user.type(screen.getByLabelText('Full description'), 'Description.');
    await user.click(screen.getAllByRole('button', { name: 'Create course' }).at(-1));

    expect(await screen.findByRole('alert')).toHaveTextContent('Course save failed.');
    expect(screen.queryByText('Course created successfully.')).not.toBeInTheDocument();
    vi.useFakeTimers();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole('alert')).toHaveTextContent('Course save failed.');
  });
});
