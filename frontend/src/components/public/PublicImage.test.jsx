// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import PublicImage from './PublicImage.jsx';

afterEach(cleanup);

describe('PublicImage', () => {
  it('renders the legacy image URL with useful alternative text', () => {
    render(<PublicImage src="https://legacy.example.test/project.jpg" alt="Project" />);
    expect(screen.getByAltText('Project')).toHaveAttribute('src', 'https://legacy.example.test/project.jpg');
  });

  it('resolves managed relative paths through the configured API origin', () => {
    render(<PublicImage src="/uploads/images/projects/123e4567-e89b-42d3-a456-426614174000.webp" alt="Project" />);
    expect(screen.getByAltText('Project')).toHaveAttribute(
      'src',
      `${window.location.origin}/uploads/images/projects/123e4567-e89b-42d3-a456-426614174000.webp`,
    );
  });

  it('uses its configured fallback when an image fails', () => {
    render(<PublicImage src="https://legacy.example.test/project.jpg" alt="Project" fallback={<span>Project fallback</span>} />);
    fireEvent.error(screen.getByAltText('Project'));
    expect(screen.getByText('Project fallback')).toBeInTheDocument();
  });
});
