import {
  Brain,
  BrainCircuit,
  ChartNoAxesCombined,
  CodeXml,
  Database,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Palette,
  Plug,
  Settings,
  Smartphone,
  TrendingUp,
  Workflow,
} from 'lucide-react';

const serviceIcons = {
  code: CodeXml,
  smartphone: Smartphone,
  layers: Layers,
  palette: Palette,
  database: Database,
  plug: Plug,
  brain: Brain,
  workflow: Workflow,
  settings: Settings,
  'life-buoy': LifeBuoy,
  'chart-no-axes-combined': ChartNoAxesCombined,
  'layout-dashboard': LayoutDashboard,
  'brain-circuit': BrainCircuit,
  'trending-up': TrendingUp,
};

export const serviceIconOptions = [
  { value: 'code', label: 'Code' },
  { value: 'smartphone', label: 'Mobile' },
  { value: 'layers', label: 'Layers' },
  { value: 'palette', label: 'Design' },
  { value: 'database', label: 'Database' },
  { value: 'plug', label: 'Integration' },
  { value: 'brain', label: 'Artificial intelligence' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'settings', label: 'Settings' },
  { value: 'life-buoy', label: 'Support' },
  { value: 'chart-no-axes-combined', label: 'Analytics' },
  { value: 'layout-dashboard', label: 'Dashboards' },
  { value: 'brain-circuit', label: 'Machine learning' },
  { value: 'trending-up', label: 'Predictive analytics' },
];

export default function ServiceIcon({ name = 'code', className }) {
  const Icon = serviceIcons[name] ?? CodeXml;
  return <Icon className={className} strokeWidth={1.7} aria-hidden="true" focusable="false" />;
}
