// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ThemeToggle from './ThemeToggle.jsx';

afterEach(cleanup);

describe('ThemeToggle', () => {
  it('shows the active light theme and toggles accessibly', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ThemeToggle theme="light" onToggle={onToggle} />);

    const button = screen.getByRole('button', { name: 'Light mode enabled. Switch to dark mode' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button.querySelector('circle')).toBeInTheDocument();

    await user.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('shows the moon icon when dark mode is active', () => {
    render(<ThemeToggle theme="dark" onToggle={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Dark mode enabled. Switch to light mode' });

    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.querySelector('circle')).not.toBeInTheDocument();
    expect(button.querySelector('path')).toBeInTheDocument();
  });
});
