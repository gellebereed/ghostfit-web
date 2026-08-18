/**
 * The lit room the whole app sits in.
 *
 * Deliberately a real DOM element rather than a `body::before`: a pseudo-element
 * at negative z-index paints *underneath* body's own background box, so an
 * opaque body background hides it completely. Real elements with positive
 * z-index have no such ambiguity.
 *
 * Two blooms, confined to the top of the viewport and masked out before they
 * reach the content. Light should fall on the masthead and then get out of the
 * way — a glow that covers the whole page stops being atmosphere and starts
 * being fog, taking legibility with it.
 */
export default function Atmosphere() {
  return (
    <div className="atmosphere" aria-hidden="true">
      <span className="aura aura-a" />
      <span className="aura aura-b" />
      <span className="aura-grain" />
    </div>
  );
}
