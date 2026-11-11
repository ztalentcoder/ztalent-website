const iconContent = {
  code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /><line x1="14" y1="4" x2="10" y2="20" /></>,
  smartphone: <><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></>,
  layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></>,
  palette: <><circle cx="13.5" cy="6.5" r=".5" /><circle cx="17.5" cy="10.5" r=".5" /><circle cx="8.5" cy="7.5" r=".5" /><circle cx="6.5" cy="12.5" r=".5" /><path d="M12 22a10 10 0 1 1 10-10c0 1.7-1.3 3-3 3h-1.8c-1.4 0-2.2 1.5-1.5 2.7.7 1.2-.1 2.3-1.5 2.3H12Z" /></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3" /></>,
  plug: <><path d="M12 22v-5M9 8V2M15 8V2M5 8h14v4a7 7 0 0 1-14 0V8Z" /></>,
  brain: <><path d="M12 18V5a3 3 0 0 0-5.8-1 4 4 0 0 0-2.1 7.3A4 4 0 0 0 7 18h5ZM12 18V5a3 3 0 0 1 5.8-1 4 4 0 0 1 2.1 7.3A4 4 0 0 1 17 18h-5ZM8 21h8" /></>,
  workflow: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><path d="M10 6h4a3 3 0 0 1 3 3v5M14 18H9a3 3 0 0 1-3-3v-5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 2Z" /></>,
  'life-buoy': <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /><path d="m5 5 4.9 4.9m4.2 4.2L19 19m0-14-4.9 4.9m-4.2 4.2L5 19" /></>,
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
];

export default function ServiceIcon({ name = 'code', className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconContent[name] ?? iconContent.code}
    </svg>
  );
}
