// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminConfirmationDialog from './AdminConfirmationDialog.jsx';

function ConfirmationHarness({ onConfirm }) {
  const [open, setOpen] = useState(true);
  return (
    <AdminConfirmationDialog
      open={open}
      title="Delete project?"
      message="This action cannot be undone."
      onConfirm={async () => {
        await onConfirm();
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

afterEach(cleanup);

describe('AdminConfirmationDialog', () => {
  it('starts with the safe cancel action focused and supports dismissal', async () => {
    const user = userEvent.setup();
    render(<ConfirmationHarness onConfirm={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Delete project?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('runs the confirmed action', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ConfirmationHarness onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
