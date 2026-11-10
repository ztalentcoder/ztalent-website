// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import styles from './TeamPage.module.css';
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
      photoUrl: 'https://images.example.test/ada-portrait.webp',
      portfolioUrl: 'https://ada.example.test',
      photoPosition: 18,
      bio: 'Do not show this biography.',
      linkedinUrl: 'https://linkedin.example/ada',
      githubUrl: 'https://github.example/ada',
    }, {
      name: 'Grace Example',
      role: 'Designer',
      photoUrl: 'https://images.example.test/grace-landscape.webp',
      portfolioUrl: null,
      photoPosition: 63,
      bio: 'Do not show this biography either.',
    }] };

    render(<MemoryRouter><TeamPage /></MemoryRouter>);
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(cards[0].parentElement).toHaveClass(styles.grid);
    expect(cards[0]).toHaveClass(styles.card);
    expect(cards[0]).not.toHaveClass('card');

    const adaCard = cards[0];
    const adaPhoto = within(adaCard).getByRole('img', { name: 'Ada Example' });
    expect(adaPhoto).toHaveClass(styles.teamPhoto);
    expect(adaPhoto).toHaveStyle({ '--team-photo-position': '18%' });
    expect(adaPhoto.parentElement).toHaveClass(styles.photoFrame);
    expect(within(adaCard).getByRole('heading', { name: 'Ada Example' })).toBeVisible();
    expect(within(adaCard).getByText('Lead Engineer')).toBeVisible();
    expect(within(adaCard).getByRole('link', { name: 'View Portfolio' })).toHaveAttribute('href', 'https://ada.example.test');
    expect(within(adaCard).queryByText(/biography/i)).not.toBeInTheDocument();
    expect(within(adaCard).queryByRole('link', { name: /linkedin|github/i })).not.toBeInTheDocument();

    const graceCard = cards[1];
    const gracePhoto = within(graceCard).getByRole('img', { name: 'Grace Example' });
    expect(gracePhoto).toBeVisible();
    expect(gracePhoto).toHaveStyle({ '--team-photo-position': '63%' });
    expect(gracePhoto.parentElement).toHaveClass(styles.photoFrame);
    expect(within(graceCard).getByText('Designer')).toBeVisible();
    expect(within(graceCard).queryByRole('link', { name: 'View Portfolio' })).not.toBeInTheDocument();
    expect(within(graceCard).queryByText(/biography/i)).not.toBeInTheDocument();
  });
});
