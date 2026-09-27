// The station schematic from the 08 brief, verbatim except the beam label,
// which is filled from the register at render time (TX-01, TX-06).
// A schematic, not to scale; the Newtonian focuser sits near the open front end on purpose.
export const SCHEMATIC_W = 820;
export const SCHEMATIC_H = 400;
export const BEAM_LABEL = '{{BEAM_LABEL}}';

export const SCHEMATIC_SVG = `<svg width="820" height="400" viewBox="0 0 820 400" fill="none" stroke="#6F82A8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 0; top: 0;" aria-label="Schematic of the transmitter station on a cart aiming a beam at the ground station telescope on its mount">
<path d="M10 360H810" stroke="#23314F"/>
<path d="M199 216 L520 118 M199 216 L520 300" stroke="#3A2B3A" stroke-dasharray="3 5"/>
<path d="M199 216 L528 194" stroke="#FF7C86" stroke-width="1.2" stroke-dasharray="6 5"/>
<text x="330" y="200" fill="#8E9CB8" stroke="none" font-family="IBM Plex Mono, monospace" font-size="11">${BEAM_LABEL}</text>
<text x="250" y="318" fill="#5B6D92" stroke="none" font-family="IBM Plex Mono, monospace" font-size="10">1 km (C1) · 300 m moving (C2) · 50–80 m indoor (C3)</text>
<rect x="40" y="300" width="190" height="28" rx="4"/>
<circle cx="70" cy="340" r="12"/><circle cx="200" cy="340" r="12"/>
<path d="M135 300V232"/>
<rect x="95" y="202" width="60" height="28" rx="3"/>
<rect x="105" y="192" width="36" height="8" rx="2"/>
<rect x="155" y="208" width="24" height="16" rx="2"/>
<rect x="179" y="204" width="5" height="24"/>
<rect x="186" y="206" width="12" height="20" rx="1"/>
<rect x="52" y="258" width="64" height="32" rx="3"/>
<rect x="70" y="266" width="20" height="16"/>
<path d="M116 266 C 124 250 124 242 125 230"/>
<rect x="160" y="262" width="50" height="30" rx="3"/>
<path d="M172 277h8M176 273v8M192 277h8"/>
<text x="40" y="382" fill="#8E9CB8" stroke="none" font-family="IBM Plex Sans, sans-serif" font-size="12">Transmitter on cart</text>
<rect x="530" y="170" width="180" height="48" rx="6"/>
<ellipse cx="530" cy="194" rx="6" ry="24"/>
<path d="M704 176v36" stroke="#4A5B80"/>
<rect x="560" y="152" width="20" height="18" rx="2"/>
<rect x="557" y="144" width="26" height="8" rx="1"/>
<rect x="559" y="128" width="22" height="16" rx="2"/>
<circle cx="570" cy="136" r="3"/>
<rect x="610" y="140" width="90" height="18" rx="4"/>
<ellipse cx="610" cy="149" rx="3" ry="9"/>
<rect x="700" y="136" width="20" height="26" rx="2"/>
<path d="M622 218v22"/>
<rect x="600" y="240" width="44" height="48" rx="6"/>
<path d="M622 288 L580 360 M622 288 L664 360 M622 288 V360"/>
<path d="M581 132 C 640 96 700 110 732 176" stroke="#4A5B80" stroke-dasharray="3 3"/>
<rect x="730" y="176" width="84" height="54" rx="4"/>
<rect x="742" y="190" width="22" height="16" stroke="#4A5B80"/>
<rect x="782" y="190" width="22" height="16" stroke="#4A5B80"/>
<rect x="747" y="246" width="50" height="26" rx="3"/>
<path d="M772 230v16M772 272 C 772 284 760 290 750 296" stroke="#4A5B80"/>
<rect x="706" y="298" width="62" height="40" rx="3"/>
<path d="M694 344h86"/>
<path d="M714 330l12-14 8 8 7-6 13 12" stroke="#4A5B80"/>
<text x="560" y="382" fill="#8E9CB8" stroke="none" font-family="IBM Plex Sans, sans-serif" font-size="12">Ground station: telescope on tracking mount</text>
<text x="700" y="356" fill="#5B6D92" stroke="none" font-family="IBM Plex Sans, sans-serif" font-size="10">laptop · ground software</text>
</svg>`;
