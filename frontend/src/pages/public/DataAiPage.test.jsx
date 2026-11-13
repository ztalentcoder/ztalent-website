// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DataAiPage from './DataAiPage.jsx';
import usePublicContent from '../../hooks/usePublicContent.js';

vi.mock('../../hooks/usePublicContent.js', () => ({ default: vi.fn() }));

const services = [
  { slug: 'data-engineering', title: 'Data Engineering & Pipeline Development', summary: 'Reliable data pipelines.', icon: 'database' },
  { slug: 'data-analytics', title: 'Data Analytics & Insights', summary: 'Actionable insights.', icon: 'chart-no-axes-combined' },
  { slug: 'data-visualization', title: 'Data Visualization & BI Dashboards', summary: 'Clear dashboards.', icon: 'layout-dashboard' },
  { slug: 'ai-machine-learning', title: 'AI & Machine Learning Solutions', summary: 'Intelligent solutions.', icon: 'brain-circuit' },
  { slug: 'predictive-analytics', title: 'Data Science & Predictive Analytics', summary: 'Forecast outcomes.', icon: 'trending-up' },
];

describe('Data & AI public catalogue', () => {
  beforeEach(() => {
    usePublicContent.mockReset();
  });

  afterEach(cleanup);

  it('shows the approved intro and published Data & AI service cards without the old process section', () => {
    usePublicContent.mockReturnValue({
      status: 'success',
      data: { items: services },
      error: '',
      retry: vi.fn(),
    });
    render(<MemoryRouter><DataAiPage /></MemoryRouter>);

    expect(usePublicContent).toHaveBeenCalledWith('services', {
      pageSize: 50,
      businessArea: 'data-ai',
    });
    expect(screen.getByRole('heading', { name: 'Driving Innovation with Data & AI' })).toBeInTheDocument();
    expect(screen.getByText(
      'We help organizations unlock the value of data through engineering, analytics, visualization, and artificial intelligence.',
    )).toBeInTheDocument();
    expect(screen.queryByText('Published Data & AI services.')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'From raw data to decisions' })).not.toBeInTheDocument();
    for (const step of ['Data sources', 'Collection', 'Cleaning', 'Storage', 'Dashboards and reports']) {
      expect(screen.queryByText(step, { exact: true })).not.toBeInTheDocument();
    }

    const serviceSection = screen.getByRole('heading', { name: 'Driving Innovation with Data & AI' })
      .closest('section');
    const cards = serviceSection.querySelectorAll('article');
    expect(cards).toHaveLength(services.length);
    for (const card of cards) {
      expect(card.querySelector('svg')).toBeInTheDocument();
      expect(card.querySelector('img, picture')).toBeNull();
      expect(card.querySelectorAll('h3, p')).toHaveLength(2);
    }
    for (const service of services) {
      expect(screen.getByRole('heading', { name: service.title })).toBeInTheDocument();
    }
  });
});
