const paths = {
  workflow: (
    <>
      <circle cx="6" cy="6" r="3" />
      <path d="M9 6h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6" />
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="6" r="3" />
    </>
  ),
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M9 21V12h6v9" />
    </>
  ),
  chart: <path d="M3 3v17a1 1 0 0 0 1 1h17M8 16v-5m5 5V5m5 11V9" />,
  sequence: (
    <>
      <circle cx="6" cy="12" r="3" />
      <circle cx="15" cy="5" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="m8 10 5-3m-5 7 7 2" />
    </>
  ),
  plug: <path d="M8 2v6m8-6v6M6 8h12v4a6 6 0 0 1-12 0Zm6 10v4" />,
  activity: <path d="M2 12h4l3-9 6 18 3-9h4" />,
  sparkles: (
    <path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6ZM20 2v4m-2-2h4" />
  ),
  timer: <path d="M10 2h4m-2 7v4l-3 2M4 12a8 8 0 1 1 1 6M4 17v-5h5" />,
  gauge: (
    <>
      <path d="M3 17a9 9 0 1 1 18 0M12 13l5-5" />
      <circle cx="12" cy="13" r="1" />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </>
  ),
  play: <path d="m7 3 14 9-14 9Z" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="m16 16 5 5" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  branch: (
    <>
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M6 3v12m3 3a9 9 0 0 0 9-9" />
    </>
  ),
  bolt: <path d="m13 2-10 12h8l-1 8 11-12h-8Z" />,
  check: <path d="m5 12 4 4L19 6" />,
};

export default function OverviewIcon({ name, size = 20, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
