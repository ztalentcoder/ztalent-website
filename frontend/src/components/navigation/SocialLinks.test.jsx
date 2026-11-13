// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../layout/Footer.jsx';
import SocialLinks from './SocialLinks.jsx';
import TopBar from './TopBar.jsx';

const context = vi.hoisted(() => ({ company: null }));

vi.mock('../../context/PublicContentContext.jsx', () => ({
  usePublicCompany: () => context,
}));

afterEach(() => {
  cleanup();
  context.company = null;
});

const socialLinks = [
  ['Instagram', 'https://www.instagram.com/ztalentcoder/'],
  ['Facebook', 'https://www.facebook.com/ztalentcoder'],
  ['WhatsApp', 'https://wa.me/255622923299'],
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

  it('uses the saved company contact details and social links in the footer', () => {
    context.company = {
      email: 'ztalentcoder@gmail.com',
      phone: '+255 622 923 299',
      socialLinks: [],
    };
    render(<MemoryRouter><Footer /></MemoryRouter>);
    const footer = screen.getByRole('contentinfo');

    expect(within(footer).getByRole('link', { name: 'ztalentcoder@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:ztalentcoder@gmail.com',
    );
    expect(within(footer).getByRole('link', { name: '+255 622 923 299' })).toHaveAttribute(
      'href',
      'tel:+255622923299',
    );
    for (const [label, href] of socialLinks) {
      expect(within(footer).getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });

  it('uses the approved footer contact details with matching icons and safe destinations', () => {
    context.company = {
      email: 'cms@example.test',
      phone: '+255 700 000 000',
      location: 'Dar es Salaam',
      socialLinks: [],
    };
    render(<MemoryRouter><Footer /></MemoryRouter>);
    const footer = screen.getByRole('contentinfo');
    const contacts = [
      ['ztalentcoder@gmail.com', 'mailto:ztalentcoder@gmail.com'],
      ['+255 622 923 299', 'tel:+255622923299'],
      ['Zanzibar', '/contact'],
    ];

    for (const [label, href] of contacts) {
      const link = within(footer).getByRole('link', { name: label });
      expect(link).toHaveAttribute('href', href);
      expect(link.parentElement.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }

    expect(within(footer).queryByRole('link', { name: 'cms@example.test' })).not.toBeInTheDocument();
    expect(within(footer).queryByRole('link', { name: '+255 700 000 000' })).not.toBeInTheDocument();
    expect(within(footer).queryByRole('link', { name: 'Dar es Salaam' })).not.toBeInTheDocument();
  });

  it('uses saved company contact details in the top bar without stale fallbacks', () => {
    context.company = { email: 'ztalentcoder@gmail.com', phone: '+255 622 923 299', socialLinks: [] };
    render(<TopBar />);

    expect(screen.getByRole('link', { name: 'ztalentcoder@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:ztalentcoder@gmail.com',
    );
    expect(screen.getByRole('link', { name: '+255 622 923 299' })).toHaveAttribute(
      'href',
      'tel:+255622923299',
    );
  });

  it('uses configured destinations over safe defaults without duplicating platforms', () => {
    context.company = {
      socialLinks: [
        { platform: 'instagram', url: 'https://www.instagram.com/ztalentcoder/' },
        { platform: 'Instagram', url: 'https://instagram.com/duplicate' },
        { platform: 'facebook', url: 'https://facebook.com/new-destination' },
        { platform: 'youtube', url: 'https://www.youtube.com/@ztalentcoder' },
      ],
    };
    render(<SocialLinks variant="footer" />);

    const navigation = screen.getByRole('navigation', { name: 'Social media' });
    expect(within(navigation).getAllByRole('link')).toHaveLength(4);
    expect(within(navigation).getByRole('link', { name: 'Facebook' })).toHaveAttribute(
      'href',
      'https://facebook.com/new-destination',
    );
    expect(within(navigation).getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/255622923299',
    );
    expect(within(navigation).getByRole('link', { name: 'Instagram' })).toHaveAttribute(
      'target',
      '_blank',
    );
  });

  it('uses the approved contact defaults when the CMS has no company record', () => {
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'ztalentcoder@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:ztalentcoder@gmail.com',
    );
    expect(screen.getByRole('link', { name: '+255 622 923 299' })).toHaveAttribute(
      'href',
      'tel:+255622923299',
    );
  });
});
