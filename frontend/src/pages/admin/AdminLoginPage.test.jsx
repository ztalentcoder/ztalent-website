// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminLoginPage from './AdminLoginPage.jsx';

const { login } = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock('../../context/AdminAuthContext.jsx', () => ({
  useAdminAuth: () => ({ login }),
}));

function renderLogin(initialEntry = '/admin/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<h1>Dashboard destination</h1>} />
        <Route path="/admin/manage/projects" element={<h1>Requested destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

beforeEach(() => {
  login.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AdminLoginPage', () => {
  it('shows a simple heading and labeled floating inputs without a logo', () => {
    renderLogin();

    const card = screen.getByRole('region', { name: 'Welcome back' });
    const children = [...card.children];
    expect(children).toHaveLength(3);
    expect(children[0]).toHaveTextContent('Welcome back');
    expect(children[0].tagName).toBe('H1');
    expect(screen.queryByText('Admin sign in')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Ztalent Coder' })).not.toBeInTheDocument();
    expect(screen.getByText('Sign in to your account to continue')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.queryByRole('button', { name: 'Reveal password' })).not.toBeInTheDocument();
  });

  it('floats labels on focus and value, and resets them when fields are cleared', async () => {
    const user = userEvent.setup();
    renderLogin();
    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Password');

    await user.click(email);
    expect(email).toHaveFocus();
    await user.type(email, 'admin@example.test');
    expect(email.parentElement).toHaveClass(/floating/);
    await user.tab();
    expect(email.parentElement).toHaveClass(/floating/);
    await user.clear(email);
    expect(email.parentElement).not.toHaveClass(/floating/);

    await user.type(password, 'secret');
    expect(password.parentElement).toHaveClass(/floating/);
    await user.clear(password);
    expect(password.parentElement).not.toHaveClass(/floating/);
    expect(screen.queryByRole('button', { name: 'Reveal password' })).not.toBeInTheDocument();
  });

  it('toggles password visibility with an accessible icon button', async () => {
    const user = userEvent.setup();
    renderLogin();
    const password = screen.getByLabelText('Password');

    await user.type(password, 'secret');
    const reveal = screen.getByRole('button', { name: 'Reveal password' });
    expect(reveal.querySelector('svg')).toBeInTheDocument();
    await user.click(reveal);
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
    await user.clear(password);
    expect(password).toHaveAttribute('type', 'password');
    expect(screen.queryByRole('button', { name: 'Hide password' })).not.toBeInTheDocument();
  });

  it('shows a safe failure toast and automatically dismisses it', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(Object.assign(new Error('Sensitive server diagnostic'), {
      status: 401,
      code: 'INVALID_CREDENTIALS',
    }));
    renderLogin();
    await user.type(screen.getByLabelText('Email'), 'admin@example.test');
    await user.type(screen.getByLabelText('Password'), 'incorrect');
    let dismissToast;
    const realSetTimeout = window.setTimeout.bind(window);
    const timeout = vi.spyOn(window, 'setTimeout').mockImplementation((callback, delay) => {
      if (delay === 3000) {
        dismissToast = callback;
        return 1;
      }
      return realSetTimeout(callback, delay);
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Login' }).closest('form'));
      await Promise.resolve();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('The email or password is incorrect.');
    expect(screen.queryByText('Sensitive server diagnostic')).not.toBeInTheDocument();
    expect(timeout).toHaveBeenCalledWith(expect.any(Function), 3000);
    expect(dismissToast).toBeTypeOf('function');
    act(() => dismissToast());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('waits for real authentication success before navigating and disables duplicate submits', async () => {
    const user = userEvent.setup();
    const request = deferred();
    login.mockReturnValue(request.promise);
    renderLogin();
    await user.type(screen.getByLabelText('Email'), 'admin@example.test');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(login).toHaveBeenCalledWith('admin@example.test', 'correct-password');
    expect(screen.getByRole('status')).toHaveTextContent('Logging in');
    expect(screen.getByRole('button', { name: /Logging in/ })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();

    request.resolve({ id: 'admin-id' });
    expect(await screen.findByRole('heading', { name: 'Dashboard destination' })).toBeInTheDocument();
  });

  it('returns to the originally requested admin page after successful authentication', async () => {
    login.mockResolvedValue({ id: 'admin-id' });
    const user = userEvent.setup();
    renderLogin({
      pathname: '/admin/login',
      state: { from: { pathname: '/admin/manage/projects' } },
    });
    await user.type(screen.getByLabelText('Email'), 'admin@example.test');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByRole('heading', { name: 'Requested destination' })).toBeInTheDocument();
  });
});
