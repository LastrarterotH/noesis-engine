/*
 * noesis-engine v0.2
 * Web Component <noesis-scene> that runs a self-contained narrative animation
 * inside a Shadow DOM. Scenes are defined as JSON with optional hook strings
 * (onInit, onStep, onDraw, onClick, onReset) compiled to Functions and called
 * each frame with a sandboxed `world` object.
 *
 * Scene config sources, in priority order:
 *   1. <script type="application/json"> child element
 *   2. `src` attribute pointing to a JSON file (fetched)
 *   3. window.noesisScenes[id] where id = `data-scene` attribute
 *
 * Minimum config shape:
 *   { canvas: { w, h, bg }, entities: [...], hooks: { onInit, onStep, onDraw, onClick } }
 *
 * Module layout:
 *   noesis-engine.js  entry, registers the custom element
 *   element.js        NoesisScene HTMLElement
 *   world.js          World (simulation + tick + draw orchestration)
 *   draw.js           Draw primitives (learner blob, mood routing)
 *   mood.js           pixel-art mood overlays
 *   accessories.js    pixel-art accessories
 *   prop-draw.js      per-prop draw functions + drawProp dispatch
 *   prop-sprites.js   PROP_SPRITES data
 *   sky-presets.js    SKY_PRESETS data
 *   audio.js          audio context, tones, ambient sounds, fx dispatch
 *   hooks.js          hook compilation
 *   util.js           color, RNG, html, anchor, APA helpers
 */

import { NoesisScene } from './element.js?v=147';
import { World } from './world.js?v=147';

if (!customElements.get('noesis-scene')) {
  customElements.define('noesis-scene', NoesisScene);
}

window.NoesisEngine = { version: '0.2.0', World };
