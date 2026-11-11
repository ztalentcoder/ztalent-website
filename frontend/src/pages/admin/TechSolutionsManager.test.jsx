// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TechSolutionsManager from './TechSolutionsManager.jsx';

const adminContentPage = vi.hoisted(() => vi.fn(({ resource, scopeTechSolutions }) => (
  <p>{`${resource}:${scopeTechSolutions ? 'scoped' : 'unscoped'}`}</p>
)));

vi.mock('./AdminContentPage.jsx', () => ({ default: adminContentPage }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Tech Solutions manager', () => {
  it('switches between scoped category and service management using existing resources', async () => {
    const user = userEvent.setup();
    render(<TechSolutionsManager />);

    expect(screen.getByRole('heading', { name: 'Tech Solutions' })).toBeInTheDocument();
    expect(screen.getByText('business-areas:scoped')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Categories' })).toHaveAttribute('aria-pressed', 'true');
    expect(adminContentPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ resource: 'business-areas', scopeTechSolutions: true }),
      undefined,
    );

    await user.click(screen.getByRole('button', { name: 'Services' }));
    expect(screen.getByText('services:scoped')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Services' })).toHaveAttribute('aria-pressed', 'true');
    expect(adminContentPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ resource: 'services', scopeTechSolutions: true }),
      undefined,
    );
  });
});
