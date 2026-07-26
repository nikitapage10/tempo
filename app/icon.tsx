export const runtime = "edge";

export default function Favicon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#0A0A0C" />
      <rect x="6" y="8" width="2" height="16" rx="1" fill="#7FB4FF" />
      <rect x="11" y="6" width="2" height="20" rx="1" fill="#F2F0EB" />
      <rect x="16" y="10" width="2" height="12" rx="1" fill="#FFB56B" />
      <rect x="21" y="7" width="2" height="18" rx="1" fill="#7FB4FF" opacity="0.6" />
      <rect x="26" y="11" width="2" height="10" rx="1" fill="#FFB56B" opacity="0.5" />
    </svg>
  );
}
