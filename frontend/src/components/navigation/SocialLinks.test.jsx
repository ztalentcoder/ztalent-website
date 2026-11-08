// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../layout/Footer.jsx';
import SocialLinks from './SocialLinks.jsx';

vi.mock('../../context/PublicContentContext.jsx', () => ({
  usePublicCompany: () => ({ company: null }),
}));

afterEach(cleanup);

const socialLinks = [
  ['Instagram', 'https://www.instagram.com/ztalentcoder/'],
  ['Facebook', 'https://www.facebook.com/ztalentcoder'],
  ['WhatsApp', 'https://wa.me/255618429083'],
  ['YouTube', 'https://www.youtube.com/@ztalentcoder'],
];

describe('public contact and social links', () => {
  it('renders the Instagram outline glyph and canonical top-bar URLs', () => {
    render(<SocialLinks />);
    const navigation = screen.getByRole('navigation', { name: 'Social media' });

    for (const [label, href] of socialLinks) {
      expect(within(navigation).getByRole('link', { name: label })).toHaveAttribute('href', href);
    }

    const instagram = within(navigation).getByRole('link', { name: 'Instagram' });
    expect(instagram.querySelector('rect')).toHaveAttribute('fill', 'none');
    expect(instagram.querySelectorAll('circle')).toHaveLength(2);
  });

  it('provides the company contact details and social links in the footer by default', () => {
    render(<MemoryRouter><Footer /></MemoryRouter>);
    const footer = screen.getByRole('contentinfo');

    expect(within(footer).getByRole('link', { name: 'ztalentcoder@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:ztalentcoder@gmail.com',
    );
    expect(within(footer).getByRole('link', { name: '+255 618 429 083' })).toHaveAttribute(
      'href',
      'tel:+255618429083',
    );
    for (const [label, href] of socialLinks) {
      expect(within(footer).getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });
});
