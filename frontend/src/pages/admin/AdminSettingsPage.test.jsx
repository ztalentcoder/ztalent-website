// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminSettingsPage from './AdminSettingsPage.jsx';

const auth = vi.hoisted(() => ({ useAdminAuth: vi.fn() }));
const api = vi.hoisted(() => ({
  changeAdminPassword: vi.fn(),
  createAssistantAdministrator: vi.fn(),
  listAdministrators: vi.fn(),
  resetAssistantAdministratorPassword: vi.fn(),
  setAdministratorStatus: vi.fn(),
  updateAdminUsername: vi.fn(),
}));

vi.mock('../../context/AdminAuthContext.jsx', () => auth);
vi.mock('../../services/adminSettingsApi.js', () => api);

const currentAdmin = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'primary.admin',
  name: 'Primary Admin',
  email: 'primary@example.test',
  role: 'SUPER_ADMIN',
};
const assistant = {
  id: '00000000-0000-4000-8000-000000000002',
  username: 'editor.one',
  role: 'ASSISTANT_ADMIN',
  isActive: true,
  createdAt: '2026-01-02T00:00:00.000Z',
  lastLoginAt: null,
};

function renderSettings(role = 'SUPER_ADMIN') {
  const updateAdmin = vi.fn();
  auth.useAdminAuth.mockReturnValue({
    admin: { ...currentAdmin, role },
    updateAdmin,
  });
  render(<AdminSettingsPage />);
  return { updateAdmin };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listAdministrators.mockResolvedValue({ administrators: [currentAdmin, assistant] });
  api.updateAdminUsername.mockResolvedValue({
    admin: { ...currentAdmin, username: 'new.admin' },
  });
  api.changeAdminPassword.mockResolvedValue({ message: 'Password changed.' });
  api.createAssistantAdministrator.mockResolvedValue({ administrator: assistant });
  api.setAdministratorStatus.mockResolvedValue({
    administrator: { ...assistant, isActive: false },
  });
  api.resetAssistantAdministratorPassword.mockResolvedValue({
    administrator: assistant,
    message: 'Password reset.',
  });
});

afterEach(cleanup);

describe('AdminSettingsPage account settings', () => {
  it('updates the username after verifying the current password', async () => {
    const user = userEvent.setup();
    const { updateAdmin } = renderSettings();
    await screen.findByText('Existing administrators');

    await user.clear(screen.getByLabelText('New username', { exact: false }));
    await user.type(screen.getByLabelText('New username', { exact: false }), 'new.admin');
    await user.type(screen.getByLabelText('Verify with current password'), 'current-password');
    await user.click(screen.getByRole('button', { name: 'Save username' }));

    await waitFor(() => expect(api.updateAdminUsername).toHaveBeenCalledWith({
      username: 'new.admin',
      currentPassword: 'current-password',
    }));
    expect(updateAdmin).toHaveBeenCalledWith(expect.objectContaining({ username: 'new.admin' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Username updated successfully.');
  });

  it('validates password confirmation and sends the current password before changing it', async () => {
    const user = userEvent.setup();
    renderSettings();
    await screen.findByText('Existing administrators');

    await user.type(screen.getByLabelText('Current password'), 'current-password');
    await user.type(screen.getByLabelText('New password', { exact: false }), 'long-new-password');
    await user.type(screen.getAllByLabelText('Confirm password')[0], 'mismatched-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('New password and confirmation must match.');
    expect(api.changeAdminPassword).not.toHaveBeenCalled();

    await user.clear(screen.getAllByLabelText('Confirm password')[0]);
    await user.type(screen.getAllByLabelText('Confirm password')[0], 'long-new-password');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(api.changeAdminPassword).toHaveBeenCalledWith({
      currentPassword: 'current-password',
      newPassword: 'long-new-password',
      confirmPassword: 'long-new-password',
    }));
    expect(await screen.findByRole('status')).toHaveTextContent('Password changed.');
  });
});

describe('AdminSettingsPage administrator management', () => {
  it('allows the Super Admin to create and deactivate an assistant administrator', async () => {
    const user = userEvent.setup();
    renderSettings();
    await screen.findByText('editor.one');

    await user.type(screen.getByLabelText('Assistant username'), 'new.assistant');
    await user.type(screen.getByLabelText('Initial password', { exact: false }), 'long-initial-password');
    await user.type(screen.getAllByLabelText('Confirm password')[1], 'long-initial-password');
    await user.click(screen.getByRole('button', { name: 'Create assistant admin' }));
    await waitFor(() => expect(api.createAssistantAdministrator).toHaveBeenCalledWith({
      username: 'new.assistant',
      newPassword: 'long-initial-password',
      confirmPassword: 'long-initial-password',
    }));
    expect(api.listAdministrators).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(api.setAdministratorStatus).toHaveBeenCalledWith(assistant.id, false));
    expect(await screen.findByText('editor.one deactivated.')).toHaveAttribute('role', 'status');
  });

  it('does not expose administrator-management controls to an Assistant Admin', () => {
    renderSettings('ASSISTANT_ADMIN');
    expect(screen.queryByRole('heading', { name: 'Administrator management' })).not.toBeInTheDocument();
    expect(api.listAdministrators).not.toHaveBeenCalled();
  });
});
