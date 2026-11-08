// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AboutPage from './AboutPage.jsx';

const companyState = vi.hoisted(() => ({ company: null }));

vi.mock('../../context/PublicContentContext.jsx', () => ({
  usePublicCompany: () => companyState,
}));

afterEach(() => {
  cleanup();
  companyState.company = null;
});

describe('AboutPage main image', () => {
  it('uses the configured home intro image inside the image wrapper', () => {
    companyState.company = { homeIntroImageUrl: 'https://images.example.test/about.webp' };
    render(<MemoryRouter><AboutPage /></MemoryRouter>);

    const image = screen.getByRole('img', {
      name: "A coding workspace representing Ztalent Coder's training and technology solutions",
    });
    expect(image).toHaveAttribute('src', 'https://images.example.test/about.webp');
    expect(image.parentElement.className).toMatch(/aboutMainImage/);
  });

  it('falls back to the existing home image when the configured image fails', async () => {
    companyState.company = { homeIntroImageUrl: 'https://images.example.test/unavailable.webp' };
    render(<MemoryRouter><AboutPage /></MemoryRouter>);
    const image = screen.getByRole('img', {
      name: "A coding workspace representing Ztalent Coder's training and technology solutions",
    });

    fireEvent.error(image);
    expect(await screen.findByRole('img', {
      name: "A coding workspace representing Ztalent Coder's training and technology solutions",
    })).toHaveAttribute('src', '/images/image1.jpg');
  });
});
