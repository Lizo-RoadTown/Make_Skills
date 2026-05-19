/**
 * BrandMark — small inline SVG used as the Make_Skills logo mark.
 *
 * A miniature glowing orb echoing the hero image's central sphere.
 * Visual identity anchor that travels across every authenticated
 * surface (sidebar header, possibly favicon, possibly /agents/build
 * intro). Vector, no image dependency, scales freely.
 */
type Props = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 24, className }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <radialGradient id="brand-orb-fill" cx="0.38" cy="0.32">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="35%" stopColor="#60a5fa" />
          <stop offset="75%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0c1e3d" />
        </radialGradient>
        <radialGradient id="brand-orb-glow" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#brand-orb-glow)" />
      <circle
        cx="16"
        cy="16"
        r="11"
        fill="url(#brand-orb-fill)"
        stroke="#60a5fa"
        strokeWidth="0.8"
        strokeOpacity="0.6"
      />
      <ellipse cx="12.5" cy="12" rx="2.5" ry="1.6" fill="#dbeafe" opacity="0.75" />
    </svg>
  );
}
