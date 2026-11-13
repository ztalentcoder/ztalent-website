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
    for (const section of ['Our Story', 'Mission and Vision', 'Core Values', 'Our Philosophy', 'Meet Our Team', 'Closing Statement']) {
      expect(screen.getByRole('group', { name: section })).toBeInTheDocument();
    }
    const heading = within(whoGroup).getByLabelText('Main heading');
    expect(within(whoGroup).getByText('Introduce Ztalent Coder and explain what the organization does.')).toBeInTheDocument();
    await user.clear(heading);
    await user.type(heading, 'A managed identity');

    const valuesGroup = screen.getByRole('group', { name: 'Core Values' });
    expect(within(valuesGroup).getAllByLabelText('Icon')).toHaveLength(6);
    expect(within(valuesGroup).getAllByLabelText('Active on public page')).toHaveLength(7);
    await user.selectOptions(within(valuesGroup).getAllByLabelText('Icon')[0], 'star');
    const closingGroup = screen.getByRole('group', { name: 'Closing Statement' });
    const finalStatement = within(closingGroup).getByLabelText('Final statement');
    await user.clear(finalStatement);
    await user.type(finalStatement, 'A newly managed final message.');
    await user.click(screen.getByRole('button', { name: 'Save About page' }));

    expect(await screen.findByRole('status')).toHaveTextContent('About page content saved successfully.');
    expect(api.updateAboutPageContent).toHaveBeenCalledWith(expect.objectContaining({
      whoWeAre: expect.objectContaining({ title: 'A managed identity' }),
      coreValues: expect.objectContaining({
        values: expect.arrayContaining([expect.objectContaining({ title: 'INNOVATION', icon: 'star' })]),
      }),
      team: expect.objectContaining({ destination: '/team' }),
      closing: expect.objectContaining({ finalStatement: 'A newly managed final message.' }),
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

  it('keeps every section field grouped and gives long content spacious editing areas', async () => {
    render(<MemoryRouter><AdminContentPage resource="about-page" /></MemoryRouter>);

    const whoGroup = await screen.findByRole('group', { name: 'Who We Are' });
    expect(within(whoGroup).getByLabelText('Small label')).toHaveValue('ABOUT ZTALENT CODER');
    expect(within(whoGroup).getByLabelText('Body content')).toHaveAttribute('rows', '10');
    expect(within(whoGroup).getByRole('group', { name: 'Display settings' })).toBeInTheDocument();

    const story = screen.getByRole('group', { name: 'Our Story' });
    expect(within(story).getByLabelText('Subheading')).toHaveValue('Story subheading');
    expect(within(story).getByLabelText('Body content')).toHaveAttribute('rows', '10');

    const missionVision = screen.getByRole('group', { name: 'Mission and Vision' });
    expect(within(missionVision).getByRole('heading', { name: 'Mission' })).toBeInTheDocument();
    expect(within(missionVision).getByRole('heading', { name: 'Vision' })).toBeInTheDocument();
    expect(within(missionVision).getByLabelText('Mission description')).toHaveAttribute('rows', '6');
    expect(within(missionVision).getByLabelText('Vision description')).toHaveAttribute('rows', '6');

    const values = screen.getByRole('group', { name: 'Core Values' });
    expect(within(values).getAllByLabelText('Value description')).toHaveLength(6);
    expect(within(values).getAllByLabelText('Icon')).toHaveLength(6);
    expect(within(values).getAllByLabelText('Value description').every((field) => field.getAttribute('rows') === '6')).toBe(true);

    const philosophy = screen.getByRole('group', { name: 'Our Philosophy' });
    expect(within(philosophy).getAllByLabelText('Principle description')).toHaveLength(3);
    expect(within(philosophy).getByLabelText('Introduction')).toHaveAttribute('rows', '10');

    const team = screen.getByRole('group', { name: 'Meet Our Team' });
    expect(within(team).getByLabelText('Button label')).toHaveValue('Meet Our Team');
    expect(within(team).getByLabelText('Button destination')).toHaveValue('/team');

    const closing = screen.getByRole('group', { name: 'Closing Statement' });
    expect(within(closing).getByLabelText('Body content')).toHaveAttribute('rows', '10');
    expect(within(closing).getByLabelText('Final statement')).toHaveAttribute('rows', '6');
  });

  it('keeps required-field validation and displays save errors', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AdminContentPage resource="about-page" /></MemoryRouter>);

    const whoGroup = await screen.findByRole('group', { name: 'Who We Are' });
    await user.clear(within(whoGroup).getByLabelText('Main heading'));
    await user.click(screen.getByRole('button', { name: 'Save About page' }));
    expect(api.updateAboutPageContent).not.toHaveBeenCalled();

    api.updateAboutPageContent.mockRejectedValueOnce(new Error('The update was rejected.'));
    await user.type(within(whoGroup).getByLabelText('Main heading'), 'Valid heading');
    await user.click(screen.getByRole('button', { name: 'Save About page' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The update was rejected.');
    expect(screen.getByRole('button', { name: 'Save About page' })).toBeEnabled();
  });
});
