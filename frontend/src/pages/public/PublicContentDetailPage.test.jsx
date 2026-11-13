// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicContentDetailPage from './PublicContentDetailPage.jsx';

const publicContent = vi.hoisted(() => ({ result: null }));

vi.mock('../../hooks/usePublicContent.js', () => ({
  default: () => publicContent.result,
}));

const baseProject = {
  slug: 'sample-project',
  title: 'Sample Project',
  summary: 'A short project summary.',
  description: 'A detailed overview.',
  problemStatement: 'A meaningful problem.',
  solution: 'A practical solution.',
  keyFeatures: [{ title: 'Accessible', description: 'Designed for everyone.' }],
  technologies: ['React', 'PostgreSQL'],
  outcome: 'A measurable impact.',
  galleryImages: ['/uploads/images/projects/gallery.png'],
  liveUrl: 'https://example.test/project',
  imageUrl: '/uploads/images/projects/cover.png',
};

function renderProject(initialEntry = '/portfolio/sample-project?page=2') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/portfolio/:slug" element={<PublicContentDetailPage type="project" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  publicContent.result = { status: 'success', data: { item: baseProject } };
});

afterEach(cleanup);

describe('public project details', () => {
  it('renders populated project details in order and preserves the listing query in the back link', () => {
    renderProject();

    expect(screen.getByRole('link', { name: 'Back to the Portfolio' })).toHaveAttribute('href', '/portfolio?page=2');
    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings).toEqual([
      'Sample Project',
      'Project Overview',
      'Problem Statement',
      'Our Solution',
      'Key Features',
      'Accessible',
      'Technologies Used',
      'Project Outcome / Impact',
      'Project Gallery',
    ]);
    expect(screen.getByText('A short project summary.')).toBeInTheDocument();
    expect(screen.getByText('A detailed overview.')).toBeInTheDocument();
    expect(screen.getByText('Accessible')).toBeInTheDocument();
    expect(screen.getByText('Designed for everyone.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Visit Live Project' })).toHaveAttribute('href', baseProject.liveUrl);
    expect(screen.getByRole('img', { name: 'Sample Project project screenshot 1' })).toBeInTheDocument();
  });

  it('hides empty optional sections and shows a fallback when a project image fails', async () => {
    publicContent.result = {
      status: 'success',
      data: {
        item: {
          ...baseProject,
          description: '',
          problemStatement: '  ',
          solution: null,
          keyFeatures: [],
          technologies: [],
          outcome: '',
          galleryImages: [],
          liveUrl: 'javascript:alert(1)',
        },
      },
    };
    renderProject('/portfolio/sample-project');

    expect(screen.queryByRole('heading', { name: 'Project Overview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Problem Statement' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Our Solution' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Key Features' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Technologies Used' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Project Outcome / Impact' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Project Gallery' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Visit Live Project' })).not.toBeInTheDocument();

    fireEvent.error(screen.getByRole('img', { name: 'Sample Project project cover' }));
    expect(await screen.findByRole('img', { name: 'Project cover image unavailable' })).toBeInTheDocument();
  });

  it('renders a not-found state for unavailable project slugs', () => {
    publicContent.result = { status: 'error', errorStatus: 404 };
    renderProject('/portfolio/unknown-slug');

    expect(screen.getByRole('heading', { name: 'Project not found' })).toBeInTheDocument();
    expect(screen.getByText('This published content is unavailable.')).toBeInTheDocument();
  });
});
