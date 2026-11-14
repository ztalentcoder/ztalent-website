import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import {
  changeAdminPassword,
  createAssistantAdministrator,
  listAdministrators,
  resetAssistantAdministratorPassword,
  setAdministratorStatus,
  updateAdminUsername,
} from '../../services/adminSettingsApi.js';
import styles from './AdminSettingsPage.module.css';

function getErrorMessage(error) {
  if (error?.status === 401) return error.message || 'Your session expired. Sign in again.';
  if (error?.status === 403) return error.message || 'You do not have permission to manage administrator accounts.';
  return error?.message || 'The request could not be completed. Please try again.';
}

function formatCreatedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function PasswordFields({ prefix, password, confirmPassword, onPasswordChange, onConfirmPasswordChange, disabled }) {
  return (
    <>
      <label className={styles.field} htmlFor={`${prefix}-password`}>
        {prefix === 'new-admin' ? 'Initial password' : 'New password'}
        <input
          id={`${prefix}-password`}
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={1024}
          required
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          disabled={disabled}
        />
        <small>Use at least 12 characters.</small>
      </label>
      <label className={styles.field} htmlFor={`${prefix}-confirm-password`}>
        Confirm password
        <input
          id={`${prefix}-confirm-password`}
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={1024}
          required
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          disabled={disabled}
        />
      </label>
    </>
  );
}

export default function AdminSettingsPage() {
  const { admin, updateAdmin } = useAdminAuth();
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
  const [username, setUsername] = useState(admin?.username ?? '');
  const [usernameCurrentPassword, setUsernameCurrentPassword] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameNotice, setUsernameNotice] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [administrators, setAdministrators] = useState([]);
  const [administratorsLoading, setAdministratorsLoading] = useState(false);
  const [administratorsError, setAdministratorsError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createNotice, setCreateNotice] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [initialPasswordConfirmation, setInitialPasswordConfirmation] = useState('');
  const [updatingAdminId, setUpdatingAdminId] = useState('');
  const [resettingAdminId, setResettingAdminId] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState('');
  const [managementError, setManagementError] = useState('');
  const [managementNotice, setManagementNotice] = useState('');

  const loadAdministrators = useCallback(async () => {
    if (!isSuperAdmin) return;
    setAdministratorsLoading(true);
    setAdministratorsError('');
    try {
      const response = await listAdministrators();
      setAdministrators(response.administrators ?? []);
    } catch (error) {
      setAdministratorsError(getErrorMessage(error));
    } finally {
      setAdministratorsLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    setUsername(admin?.username ?? '');
  }, [admin?.username]);

  useEffect(() => {
    void loadAdministrators();
  }, [loadAdministrators]);

  async function submitUsername(event) {
    event.preventDefault();
    if (usernameSaving) return;
    setUsernameSaving(true);
    setUsernameError('');
    setUsernameNotice('');
    try {
      const response = await updateAdminUsername({
        username,
        currentPassword: usernameCurrentPassword,
      });
      updateAdmin(response.admin);
      setUsername(response.admin.username);
      setUsernameCurrentPassword('');
      setUsernameNotice('Username updated successfully.');
    } catch (error) {
      setUsernameError(getErrorMessage(error));
    } finally {
      setUsernameSaving(false);
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    if (passwordSaving) return;
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation must match.');
      return;
    }
    setPasswordSaving(true);
    setPasswordError('');
    setPasswordNotice('');
    try {
      const response = await changeAdminPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordNotice(response.message || 'Password changed successfully.');
    } catch (error) {
      setPasswordError(getErrorMessage(error));
    } finally {
      setPasswordSaving(false);
    }
  }

  async function submitAssistant(event) {
    event.preventDefault();
    if (creating) return;
    if (initialPassword !== initialPasswordConfirmation) {
      setCreateError('Initial password and confirmation must match.');
      return;
    }
    setCreating(true);
    setCreateError('');
    setCreateNotice('');
    try {
      await createAssistantAdministrator({
        username: newUsername,
        newPassword: initialPassword,
        confirmPassword: initialPasswordConfirmation,
      });
      setNewUsername('');
      setInitialPassword('');
      setInitialPasswordConfirmation('');
      setCreateNotice('Assistant administrator created.');
      await loadAdministrators();
    } catch (error) {
      setCreateError(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function toggleAdministrator(adminEntry) {
    if (updatingAdminId) return;
    setUpdatingAdminId(adminEntry.id);
    setManagementError('');
    setManagementNotice('');
    try {
      const response = await setAdministratorStatus(adminEntry.id, !adminEntry.isActive);
      setAdministrators((current) => current.map((entry) => (
        entry.id === response.administrator.id ? response.administrator : entry
      )));
      setManagementNotice(`${adminEntry.username} ${response.administrator.isActive ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setManagementError(getErrorMessage(error));
    } finally {
      setUpdatingAdminId('');
    }
  }

  async function submitPasswordReset(event, adminEntry) {
    event.preventDefault();
    if (updatingAdminId) return;
    if (resetPassword !== resetPasswordConfirmation) {
      setManagementError('New password and confirmation must match.');
      return;
    }
    setUpdatingAdminId(adminEntry.id);
    setManagementError('');
    setManagementNotice('');
    try {
      const response = await resetAssistantAdministratorPassword(adminEntry.id, {
        newPassword: resetPassword,
        confirmPassword: resetPasswordConfirmation,
      });
      setAdministrators((current) => current.map((entry) => (
        entry.id === response.administrator.id ? response.administrator : entry
      )));
      setResettingAdminId('');
      setResetPassword('');
      setResetPasswordConfirmation('');
      setManagementNotice(response.message || `Password reset for ${adminEntry.username}.`);
    } catch (error) {
      setManagementError(getErrorMessage(error));
    } finally {
      setUpdatingAdminId('');
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeading}>
        <p className={styles.eyebrow}>Account access</p>
        <h1>Settings</h1>
        <p>Update your administrator account and manage dashboard access.</p>
      </header>

      <div className={styles.sections}>
        <section className={styles.card} aria-labelledby="username-heading">
          <div className={styles.sectionHeading}>
            <h2 id="username-heading">Change my username</h2>
            <p>Your username is also accepted when signing in.</p>
          </div>
          {usernameError && <p className={styles.error} role="alert">{usernameError}</p>}
          {usernameNotice && <p className={styles.success} role="status">{usernameNotice}</p>}
          <form className={styles.form} onSubmit={(event) => void submitUsername(event)}>
            <label className={styles.field} htmlFor="current-username">
              Current username
              <input id="current-username" value={admin?.username ?? ''} readOnly />
            </label>
            <label className={styles.field} htmlFor="new-username">
              New username
              <input
                id="new-username"
                autoComplete="username"
                minLength={3}
                maxLength={64}
                pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,63}"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={usernameSaving}
              />
              <small>3–64 letters, numbers, dots, underscores, or hyphens.</small>
            </label>
            <label className={styles.field} htmlFor="username-current-password">
              Verify with current password
              <input
                id="username-current-password"
                type="password"
                autoComplete="current-password"
                required
                value={usernameCurrentPassword}
                onChange={(event) => setUsernameCurrentPassword(event.target.value)}
                disabled={usernameSaving}
              />
            </label>
            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="submit" disabled={usernameSaving}>
                {usernameSaving ? 'Saving…' : 'Save username'}
              </button>
            </div>
          </form>
        </section>

        <section className={styles.card} aria-labelledby="password-heading">
          <div className={styles.sectionHeading}>
            <h2 id="password-heading">Change my password</h2>
            <p>Other active sessions will be signed out after the password changes.</p>
          </div>
          {passwordError && <p className={styles.error} role="alert">{passwordError}</p>}
          {passwordNotice && <p className={styles.success} role="status">{passwordNotice}</p>}
          <form className={styles.form} onSubmit={(event) => void submitPassword(event)}>
            <label className={styles.field} htmlFor="account-current-password">
              Current password
              <input
                id="account-current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={passwordSaving}
              />
            </label>
            <PasswordFields
              prefix="account-new"
              password={newPassword}
              confirmPassword={confirmPassword}
              onPasswordChange={setNewPassword}
              onConfirmPasswordChange={setConfirmPassword}
              disabled={passwordSaving}
            />
            <div className={styles.formActions}>
              <button className={styles.primaryButton} type="submit" disabled={passwordSaving}>
                {passwordSaving ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </form>
        </section>

        {isSuperAdmin && (
          <section className={styles.card} aria-labelledby="administrator-management-heading">
            <div className={styles.sectionHeading}>
              <h2 id="administrator-management-heading">Administrator management</h2>
              <p>Create and manage assistant administrator accounts. Super Admin accounts are protected.</p>
            </div>
            {createError && <p className={styles.error} role="alert">{createError}</p>}
            {createNotice && <p className={styles.success} role="status">{createNotice}</p>}
            <form className={styles.form} onSubmit={(event) => void submitAssistant(event)}>
              <label className={styles.field} htmlFor="assistant-username">
                Assistant username
                <input
                  id="assistant-username"
                  autoComplete="username"
                  minLength={3}
                  maxLength={64}
                  pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,63}"
                  required
                  value={newUsername}
                  onChange={(event) => setNewUsername(event.target.value)}
                  disabled={creating}
                />
              </label>
              <PasswordFields
                prefix="new-admin"
                password={initialPassword}
                confirmPassword={initialPasswordConfirmation}
                onPasswordChange={setInitialPassword}
                onConfirmPasswordChange={setInitialPasswordConfirmation}
                disabled={creating}
              />
              <div className={styles.formActions}>
                <button className={styles.primaryButton} type="submit" disabled={creating}>
                  {creating ? 'Creating…' : 'Create assistant admin'}
                </button>
              </div>
            </form>

            <div className={styles.administratorsSection}>
              <h3>Existing administrators</h3>
              {administratorsError && <p className={styles.error} role="alert">{administratorsError}</p>}
              {managementError && <p className={styles.error} role="alert">{managementError}</p>}
              {managementNotice && <p className={styles.success} role="status">{managementNotice}</p>}
              {administratorsLoading ? (
                <p role="status">Loading administrators…</p>
              ) : administrators.length === 0 ? (
                <p>No administrator accounts were returned.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Username</th>
                        <th scope="col">Role</th>
                        <th scope="col">Created</th>
                        <th scope="col">Status</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {administrators.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.username}</td>
                          <td>{entry.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Assistant Admin'}</td>
                          <td>{formatCreatedAt(entry.createdAt)}</td>
                          <td>{entry.isActive ? 'Active' : 'Inactive'}</td>
                          <td>
                            {entry.role === 'SUPER_ADMIN' ? (
                              <span className={styles.protected}>Protected</span>
                            ) : (
                              <div className={styles.rowActions}>
                                <button
                                  className={styles.secondaryButton}
                                  type="button"
                                  disabled={updatingAdminId === entry.id}
                                  onClick={() => void toggleAdministrator(entry)}
                                >
                                  {entry.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  className={styles.secondaryButton}
                                  type="button"
                                  aria-expanded={resettingAdminId === entry.id}
                                  onClick={() => {
                                    setResettingAdminId((current) => current === entry.id ? '' : entry.id);
                                    setResetPassword('');
                                    setResetPasswordConfirmation('');
                                    setManagementError('');
                                  }}
                                >
                                  Reset password
                                </button>
                              </div>
                            )}
                            {resettingAdminId === entry.id && (
                              <form
                                className={styles.resetForm}
                                aria-label={`Reset password for ${entry.username}`}
                                onSubmit={(event) => void submitPasswordReset(event, entry)}
                              >
                                <PasswordFields
                                  prefix={`reset-${entry.id}`}
                                  password={resetPassword}
                                  confirmPassword={resetPasswordConfirmation}
                                  onPasswordChange={setResetPassword}
                                  onConfirmPasswordChange={setResetPasswordConfirmation}
                                  disabled={updatingAdminId === entry.id}
                                />
                                <button
                                  className={styles.primaryButton}
                                  type="submit"
                                  disabled={updatingAdminId === entry.id}
                                >
                                  {updatingAdminId === entry.id ? 'Resetting…' : 'Save new password'}
                                </button>
                              </form>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
