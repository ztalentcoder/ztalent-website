// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ContactPage from './ContactPage.jsx';

const mocks = vi.hoisted(() => ({
  usePublicCompany: vi.fn(),
  submitContactMessage: vi.fn(),
}));

vi.mock('../../context/PublicContentContext.jsx', () => ({
  usePublicCompany: mocks.usePublicCompany,
}));

vi.mock('../../services/contactApi.js', () => ({
  submitContactMessage: mocks.submitContactMessage,
}));

const company = {
  email: 'hello@ztalentcoder.com',
  phone: '+255 700 000 000',
  location: 'Dar es Salaam',
  hours: 'Monday to Friday',
  socialLinks: [
    { platform: 'instagram', url: 'https://www.instagram.com/ztalentcoder/' },
    { platform: 'facebook', url: 'https://www.facebook.com/ztalentcoder' },
    { platform: 'whatsapp', url: 'https://wa.me/255622923299' },
    { platform: 'youtube', url: 'https://www.youtube.com/@ztalentcoder' },
  ],
};

function renderContactPage() {
  return render(<MemoryRouter><ContactPage /></MemoryRouter>);
}

describe('ContactPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usePublicCompany.mockReturnValue({
      company,
      status: 'success',
      error: '',
      retry: vi.fn(),
    });
    mocks.submitContactMessage.mockResolvedValue({
      status: 201,
      body: { status: 'received', message: 'Thank you. We will get back to you soon.' },
    });
  });

  afterEach(cleanup);

  it('presents labeled contact details and submits the existing contact fields', async () => {
    const user = userEvent.setup();
    renderContactPage();

    expect(screen.getByRole('heading', { name: 'Contact Us' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: company.email })).toHaveAttribute('href', `mailto:${company.email}`);
    expect(screen.getByRole('link', { name: company.phone })).toHaveAttribute('href', 'tel:+255700000000');
    expect(screen.getByText(company.location)).toBeInTheDocument();
    const socialNavigation = screen.getByRole('navigation', { name: 'Social media' });
    expect(within(socialNavigation).getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/255622923299',
    );
    expect(within(socialNavigation).getAllByRole('link')).toHaveLength(4);

    await user.type(screen.getByLabelText('Name or institution'), 'Amina Example');
    await user.type(screen.getByLabelText('Email address'), 'amina@example.com');
    await user.type(screen.getByLabelText('Phone or WhatsApp (optional)'), '+255700000001');
    await user.selectOptions(screen.getByLabelText('What can we help with?'), 'REQUEST_SYSTEM');
    await user.type(screen.getByLabelText('Your message'), 'We need a new website.');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Thank you. We will get back to you soon.');
    expect(mocks.submitContactMessage).toHaveBeenCalledWith({
      name: 'Amina Example',
      email: 'amina@example.com',
      phone: '+255700000001',
      topic: 'REQUEST_SYSTEM',
      message: 'We need a new website.',
    });
  });

  it('shows a clear error if sending the message fails', async () => {
    const user = userEvent.setup();
    mocks.submitContactMessage.mockRejectedValueOnce(new Error('Network unavailable'));
    renderContactPage();

    await user.type(screen.getByLabelText('Name or institution'), 'Amina Example');
    await user.type(screen.getByLabelText('Email address'), 'amina@example.com');
    await user.type(screen.getByLabelText('Your message'), 'Please contact me.');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to connect right now. Please check your connection and try again.',
    );
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
  });

  it('uses approved defaults when the CMS has no saved contact details or profile record', () => {
    mocks.usePublicCompany.mockReturnValue({
      company: null,
      status: 'success',
      error: '',
      retry: vi.fn(),
    });
    renderContactPage();

    expect(screen.getByRole('link', { name: 'ztalentcoder@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:ztalentcoder@gmail.com',
    );
    expect(screen.getByRole('link', { name: '+255 622 923 299' })).toHaveAttribute(
      'href',
      'tel:+255622923299',
    );
    expect(screen.getByText('Zanzibar')).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Social media' });
    expect(within(navigation).getAllByRole('link')).toHaveLength(4);
    expect(within(navigation).getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/255622923299',
    );
  });

  it('falls back per field when saved CMS contact values are blank', () => {
    mocks.usePublicCompany.mockReturnValue({
      company: { email: '', phone: null, location: '' },
      status: 'success',
      error: '',
      retry: vi.fn(),
    });
    renderContactPage();

    expect(screen.getByRole('link', { name: 'ztalentcoder@gmail.com' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+255 622 923 299' })).toBeInTheDocument();
    expect(screen.getByText('Zanzibar')).toBeInTheDocument();
  });

  it('keeps approved defaults visible while showing a CMS loading error', () => {
    mocks.usePublicCompany.mockReturnValue({
      company: null,
      status: 'error',
      error: 'Company content is temporarily unavailable.',
      retry: vi.fn(),
    });
    renderContactPage();

    expect(screen.getByRole('alert')).toHaveTextContent('Company content is temporarily unavailable.');
    expect(screen.getByRole('link', { name: 'ztalentcoder@gmail.com' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+255 622 923 299' })).toBeInTheDocument();
    expect(screen.getByText('Zanzibar')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Social media' })).toBeInTheDocument();
  });
});
