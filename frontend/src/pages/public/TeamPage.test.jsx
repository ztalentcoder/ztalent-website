// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { styles } from '../../components/public/PublicPage.jsx';
import TeamPage from './TeamPage.jsx';

const teamState = vi.hoisted(() => ({
  data: { items: [] },
  status: 'success',
}));

vi.mock('../../hooks/usePublicContent.js', () => ({
  default: () => teamState,
}));

afterEach(() => {
  cleanup();
  teamState.data = { items: [] };
});

describe('TeamPage cards', () => {
  it('shows only portraits, names, roles, and portfolio links when available', () => {
    teamState.data = { items: [{
      name: 'Ada Example',
      role: 'Lead Engineer',
      photoUrl: 'https://images.example.test/ada.webp',
      portfolioUrl: 'https://ada.example.test',
      bio: 'Do not show this biography.',
      linkedinUrl: 'https://linkedin.example/ada',
      githubUrl: 'https://github.example/ada',
    }, {
      name: 'Grace Example',
      role: 'Designer',
      photoUrl: 'https://images.example.test/grace.webp',
      portfolioUrl: null,
      bio: 'Do not show this biography either.',
    }] };

    render(<MemoryRouter><TeamPage /></MemoryRouter>);
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);

    const adaCard = cards[0];
    expect(within(adaCard).getByRole('img', { name: 'Ada Example' })).toHaveClass(styles.teamPhoto);
    expect(within(adaCard).getByRole('heading', { name: 'Ada Example' })).toBeVisible();
    expect(within(adaCard).getByText('Lead Engineer')).toBeVisible();
    expect(within(adaCard).getByRole('link', { name: 'View Portfolio' })).toHaveAttribute('href', 'https://ada.example.test');
    expect(within(adaCard).queryByText(/biography/i)).not.toBeInTheDocument();
    expect(within(adaCard).queryByRole('link', { name: /linkedin|github/i })).not.toBeInTheDocument();

    const graceCard = cards[1];
    expect(within(graceCard).getByRole('img', { name: 'Grace Example' })).toBeVisible();
    expect(within(graceCard).getByText('Designer')).toBeVisible();
    expect(within(graceCard).queryByRole('link', { name: 'View Portfolio' })).not.toBeInTheDocument();
    expect(within(graceCard).queryByText(/biography/i)).not.toBeInTheDocument();
  });
});
