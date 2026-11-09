// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AboutPage from './AboutPage.jsx';

const api = vi.hoisted(() => ({ getPublicContent: vi.fn() }));

vi.mock('../../services/publicContentApi.js', () => ({
  getPublicContent: api.getPublicContent,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function aboutContent() {
  return {
    whoWeAre: {
      label: 'ABOUT ZTALENT CODER',
      title: 'Empowering Talent. Building Technology. Shaping the Future.',
      body: 'Ztalent Coder is a technology-driven company committed to empowering individuals, advancing digital innovation, and building technology solutions that create meaningful impact.\n\nWe believe technology is more than just tools and systems; it is an opportunity to solve problems, unlock potential, connect communities, and create new possibilities.\n\nThrough a combination of technology, education, creativity, and collaboration, we aim to contribute to a future where individuals and organizations can use technology to grow, innovate, and achieve more.\n\nOur focus is on building meaningful solutions, developing technological skills, and creating opportunities that support sustainable digital growth.',
    },
    story: { label: 'OUR JOURNEY', title: 'The Story Behind Ztalent Coder', subheading: 'Driven by Possibility. Inspired by Innovation.', body: 'Our story.' },
    missionVision: { missionLabel: 'OUR MISSION', missionTitle: 'Mission heading', missionDescription: 'Mission copy.', visionLabel: 'OUR VISION', visionTitle: 'Vision heading', visionDescription: 'Vision copy.' },
    coreValues: { label: 'WHAT WE STAND FOR', title: 'The Principles That Guide Us', description: 'Values intro.', values: [{ title: 'INNOVATION', description: 'Value copy.', icon: 'spark' }] },
    philosophy: { label: 'OUR APPROACH', title: 'Technology with Purpose. Talent with Potential.', introduction: 'Philosophy intro.', principles: [{ title: 'PEOPLE FIRST', description: 'People copy.' }], closing: 'Philosophy close.' },
    team: { label: 'THE PEOPLE BEHIND ZTALENT CODER', title: 'Meet the People Behind Our Vision', description: 'Meet the team.', buttonLabel: 'Meet Our Team', destination: '/team' },
    closing: { title: 'Building the Future Together.', body: 'Closing body.', finalStatement: 'Together, let’s shape the future.' },
  };
}

describe('AboutPage', () => {
  it('renders all managed sections without images and links to the existing team route', async () => {
    api.getPublicContent.mockResolvedValue({ item: aboutContent() });
    render(
      <MemoryRouter initialEntries={['/about']}>
        <Routes>
          <Route path="/about" element={<AboutPage />} />
          <Route path="/team" element={<h1>Existing team page</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Who We Are', level: 1 })).toBeVisible();
    expect(screen.getByText('ABOUT ZTALENT CODER')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Empowering Talent. Building Technology. Shaping the Future.', level: 2 })).toBeVisible();
    expect(screen.getByText('Ztalent Coder is a technology-driven company committed to empowering individuals, advancing digital innovation, and building technology solutions that create meaningful impact.')).toBeVisible();
    expect(screen.getByText('We believe technology is more than just tools and systems; it is an opportunity to solve problems, unlock potential, connect communities, and create new possibilities.')).toBeVisible();
    expect(screen.getByText('Through a combination of technology, education, creativity, and collaboration, we aim to contribute to a future where individuals and organizations can use technology to grow, innovate, and achieve more.')).toBeVisible();
    expect(screen.getByText('Our focus is on building meaningful solutions, developing technological skills, and creating opportunities that support sustainable digital growth.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'The Story Behind Ztalent Coder' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Mission heading' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'The Principles That Guide Us' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Technology with Purpose. Talent with Potential.' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Meet the People Behind Our Vision' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Building the Future Together.' })).not.toBeInTheDocument();
    expect(screen.queryByText('Together, let’s shape the future.')).not.toBeInTheDocument();
    expect(screen.queryByText('02 / A')).not.toBeInTheDocument();
    expect(screen.queryByText('02 / B')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const sections = screen.getByRole('main').querySelectorAll(':scope > section');
    expect(sections).toHaveLength(7);
    expect(sections[0].querySelectorAll('svg')).toHaveLength(3);
    expect(sections[sections.length - 1]).toHaveTextContent('Meet Our Team');
    expect(api.getPublicContent).toHaveBeenCalledWith('about-page');

    fireEvent.click(screen.getByRole('link', { name: 'Meet Our Team' }));
    expect(await screen.findByRole('heading', { name: 'Existing team page' })).toBeVisible();
  });

  it('shows loading and error feedback with a retry action', async () => {
    api.getPublicContent.mockRejectedValueOnce(new Error('Content unavailable'))
      .mockResolvedValueOnce({ item: aboutContent() });
    render(<MemoryRouter><AboutPage /></MemoryRouter>);

    expect(screen.getByRole('status')).toHaveTextContent('Loading About Ztalent Coder');
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(api.getPublicContent).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('heading', { name: 'Meet the People Behind Our Vision' })).toBeVisible();
  });
});
