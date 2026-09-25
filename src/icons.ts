// Inline stroke icons, one per subsystem (data/subsystems.yaml "icon").
const P: Record<string, string> = {
  // laser beam: emitter box with a widening beam
  laser: '<rect x="2" y="9" width="7" height="6" rx="1"/><path d="M9 11.5 21 7M9 12.5 21 17M13 12h2M17 12h2"/>',
  // telescope on a tripod
  telescope: '<path d="m3 11 13-5 2 5-13 5z"/><path d="m16 6 3-1 2 5-3 1"/><path d="M10 14.5 7 21M11 14l3 7M10.5 14v7"/>',
  // circuit board with traces
  board: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><circle cx="16" cy="16" r="1.5"/><path d="M9.5 8H14v6.5M8 9.5V16h6.5M16 3v3M3 16h3"/>',
  // chip with pins
  chip: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  // laptop
  laptop: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20l-1.5-3h-17z"/>',
  // crosshair
  crosshair: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  // battery with a bolt
  battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10.5v3M12 9l-2.5 3.5h4L11 16"/>',
  // shield
  shield: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  // balloon with payload
  balloon: '<path d="M12 2a6 6 0 0 0-6 6c0 4 3.5 7 6 8 2.5-1 6-4 6-8a6 6 0 0 0-6-6z"/><path d="M12 16v4M10 20h4v2h-4z"/>',
};

export function icon(name: string, size = 28): string {
  const body = P[name] ?? '<circle cx="12" cy="12" r="9"/>';
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
