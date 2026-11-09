export default function PrototypeIcon({ name }) {
  const paths = {
    academic: <><path d="m2 10 10-6 10 6-10 6L2 10Z" /><path d="M6 13v5c3 3 9 3 12 0v-5m4-3v7" /></>,
    solutions: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 22h8m-4-4v4M7 9h10M7 13h6" /></>,
    data: <><path d="M3 20h18M5 18V8m5 10v-5m5 5V4m5 14v-8" /><path d="m4 7 6 4 5-6 5 3" /></>,
    courses: <><path d="M4 5h16v15H4zM8 9h8M8 13h8M8 17h5" /></>,
    projects: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15l3-3 3 2 4-5m-2 0h2v2" /></>,
    institutions: <><path d="m2 9 10-5 10 5H2Zm2 2h16M6 11v7m4-7v7m4-7v7m4-7v7M3 21h18" /></>,
    students: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20v-2a6 6 0 0 1 12 0v2H3Zm13-5a5 5 0 0 1 5 5h-3" /></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
    shield: <><path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2H3Zm12-11a3 3 0 1 0 0-6m1 11a5 5 0 0 1 5 5h-3" /></>,
    learning: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" /><path d="M4 17a2.5 2.5 0 0 1 2.5-2.5H20M8 7h8m-8 4h6" /></>,
    impact: <><path d="M12 21s-8-4.4-8-11a4.5 4.5 0 0 1 8-2.9A4.5 4.5 0 0 1 20 10c0 6.6-8 11-8 11Z" /><path d="m8 12 2.5 2.5L16 9" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] || paths.solutions}
    </svg>
  );
}
