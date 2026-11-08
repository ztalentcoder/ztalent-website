export default function PrototypeIcon({ name }) {
  const paths = {
    academic: <><path d="m2 10 10-6 10 6-10 6L2 10Z" /><path d="M6 13v5c3 3 9 3 12 0v-5m4-3v7" /></>,
    solutions: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 22h8m-4-4v4M7 9h10M7 13h6" /></>,
    data: <><path d="M3 20h18M5 18V8m5 10v-5m5 5V4m5 14v-8" /><path d="m4 7 6 4 5-6 5 3" /></>,
    courses: <><path d="M4 5h16v15H4zM8 9h8M8 13h8M8 17h5" /></>,
    projects: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15l3-3 3 2 4-5m-2 0h2v2" /></>,
    institutions: <><path d="m2 9 10-5 10 5H2Zm2 2h16M6 11v7m4-7v7m4-7v7m4-7v7M3 21h18" /></>,
    students: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20v-2a6 6 0 0 1 12 0v2H3Zm13-5a5 5 0 0 1 5 5h-3" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] || paths.solutions}
    </svg>
  );
}
