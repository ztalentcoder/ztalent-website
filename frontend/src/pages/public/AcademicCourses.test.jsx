// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AcademicCoursePage from './AcademicCoursePage.jsx';
import CourseCatalogue from './CourseCatalogue.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';

vi.mock('../../hooks/usePublicContent.js', () => ({ default: vi.fn() }));

const category = { slug: 'web-development', name: 'Web Development' };
const courses = [{
  slug: 'accessible-web',
  title: 'Accessible Web Development',
  summary: 'Build accessible websites.',
  description: 'Learn practical accessibility.',
  imageUrl: null,
  level: 'BEGINNER',
  episodeCount: 2,
  externalUrl: null,
  category,
}];

function catalogueContent(path, query) {
  if (path === 'course-categories') {
    return { status: 'success', data: { items: [category] }, retry: vi.fn() };
  }
  return {
    status: 'success',
    data: { items: courses, pagination: { page: query.page, pageCount: 1 } },
    retry: vi.fn(),
  };
}

describe('Academic course pages', () => {
  beforeEach(() => {
    usePublicContent.mockReset();
  });

  it('combines catalogue search and category filters and hides a missing YouTube action', async () => {
    usePublicContent.mockImplementation(catalogueContent);
    render(<MemoryRouter><CourseCatalogue /></MemoryRouter>);

    expect(await screen.findByText('Explore Our Courses')).toBeInTheDocument();
    expect(screen.getByText('Accessible Web Development')).toBeInTheDocument();
    expect(screen.queryByText('Watch on YouTube')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: /search courses/i }), {
      target: { value: 'accessible' },
    });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'web-development' } });

    await waitFor(() => {
      const calls = usePublicContent.mock.calls.filter(([path]) => path === 'academic-courses');
      expect(calls.at(-1)[1]).toMatchObject({
        search: 'accessible',
        category: 'web-development',
        page: 1,
      });
    });
  });

  it('shows published course details and ordered episodes on the detail route', async () => {
    usePublicContent.mockImplementation((path) => ({
      status: 'success',
      data: {
        item: {
          ...courses[0],
          description: 'A complete course description.',
          externalUrl: 'https://youtu.be/abcdefghijk',
          learningOutcomes: ['Build accessible pages'],
          requirements: ['Basic HTML'],
          episodes: [
            { number: 1, title: 'Semantic HTML', summary: 'Start with structure.', youtubeUrl: 'https://youtu.be/abcdefghijk' },
          ],
        },
      },
      retry: vi.fn(),
    }));
    render(
      <MemoryRouter initialEntries={['/academic/courses/accessible-web']}>
        <Routes>
          <Route path="/academic/courses/:slug" element={<AcademicCoursePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', {
      name: 'Accessible Web Development',
      level: 1,
    })).toBeInTheDocument();
    expect(screen.getByText('What You Will Learn')).toBeInTheDocument();
    expect(screen.getByText('Course Requirements')).toBeInTheDocument();
    expect(screen.queryByText(/open in new window/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /watch on youtube/i })).toHaveAttribute(
      'href',
      'https://youtu.be/abcdefghijk',
    );
    expect(screen.getByRole('link', { name: /watch episode 1: semantic html/i })).toHaveAttribute(
      'href',
      'https://youtu.be/abcdefghijk',
    );
  });
});
