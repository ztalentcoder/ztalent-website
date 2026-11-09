// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminContentPage from './AdminContentPage.jsx';

const api = vi.hoisted(() => ({
  getAboutPageContent: vi.fn(),
  updateAboutPageContent: vi.fn(),
}));

vi.mock('../../services/adminContentApi.js', () => api);

function contentFixture() {
  return {
    whoWeAre: { label: 'ABOUT ZTALENT CODER', title: 'Identity heading', body: 'Identity copy.', isActive: true, sortOrder: 0 },
    story: { label: 'OUR JOURNEY', title: 'Story heading', subheading: 'Story subheading', body: 'Story copy.', isActive: true, sortOrder: 1 },
    missionVision: { missionLabel: 'OUR MISSION', missionTitle: 'Mission heading', missionDescription: 'Mission copy.', visionLabel: 'OUR VISION', visionTitle: 'Vision heading', visionDescription: 'Vision copy.', isActive: true, sortOrder: 2 },
    coreValues: {
      label: 'WHAT WE STAND FOR', title: 'Values heading', description: 'Values intro.', isActive: true, sortOrder: 3,
      values: ['INNOVATION', 'EXCELLENCE', 'INTEGRITY', 'COLLABORATION', 'CONTINUOUS LEARNING', 'IMPACT'].map((title, sortOrder) => ({ title, description: `${title} copy.`, icon: 'spark', sortOrder, isActive: true })),
    },
    philosophy: {
      label: 'OUR APPROACH', title: 'Philosophy heading', introduction: 'Intro.', closing: 'Closing.', isActive: true, sortOrder: 4,
      principles: ['PEOPLE FIRST', 'INNOVATION WITH PURPOSE', 'GROWTH THROUGH COLLABORATION'].map((title, sortOrder) => ({ title, description: `${title} copy.`, sortOrder, isActive: true })),
    },
    team: { label: 'THE PEOPLE BEHIND ZTALENT CODER', title: 'Team heading', description: 'Team copy.', buttonLabel: 'Meet Our Team', destination: '/team', isActive: true, sortOrder: 5 },
    closing: { title: 'Closing heading', body: 'Closing body.', finalStatement: 'Final statement.', isActive: true, sortOrder: 6 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getAboutPageContent.mockResolvedValue({ item: { content: contentFixture() } });
  api.updateAboutPageContent.mockImplementation(async (content) => ({ item: { content } }));
});

afterEach(cleanup);

describe('AboutPageEditor', () => {
  it('loads grouped content and saves section and value edits', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AdminContentPage resource="about-page" /></MemoryRouter>);

    const whoGroup = await screen.findByRole('group', { name: 'Who We Are' });
    expect(screen.queryByRole('group', { name: 'Closing Statement' })).not.toBeInTheDocument();
    const heading = within(whoGroup).getByLabelText('Main heading');
    await user.clear(heading);
    await user.type(heading, 'A managed identity');

    const valuesGroup = screen.getByRole('group', { name: 'Core Values' });
    expect(within(valuesGroup).getAllByLabelText('Icon')).toHaveLength(6);
    expect(within(valuesGroup).getAllByLabelText('Active on public page')).toHaveLength(7);
    await user.selectOptions(within(valuesGroup).getAllByLabelText('Icon')[0], 'star');
    await user.click(screen.getByRole('button', { name: 'Save About page' }));

    expect(await screen.findByRole('status')).toHaveTextContent('About page content saved successfully.');
    expect(api.updateAboutPageContent).toHaveBeenCalledWith(expect.objectContaining({
      whoWeAre: expect.objectContaining({ title: 'A managed identity' }),
      coreValues: expect.objectContaining({
        values: expect.arrayContaining([expect.objectContaining({ title: 'INNOVATION', icon: 'star' })]),
      }),
      team: expect.objectContaining({ destination: '/team' }),
      closing: contentFixture().closing,
    }));
  });

  it('cancels unsaved edits by restoring the loaded content', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AdminContentPage resource="about-page" /></MemoryRouter>);

    const whoGroup = await screen.findByRole('group', { name: 'Who We Are' });
    const heading = within(whoGroup).getByLabelText('Main heading');
    await user.clear(heading);
    await user.type(heading, 'Unsaved change');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(heading).toHaveValue('Identity heading');
    expect(screen.getByRole('status')).toHaveTextContent('Changes discarded.');
    expect(api.updateAboutPageContent).not.toHaveBeenCalled();
  });
});
