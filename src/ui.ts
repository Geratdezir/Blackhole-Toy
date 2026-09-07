import { TYPES, type Kind } from './objects';
export function createUI(root: HTMLElement) {
  root.innerHTML = `<main id="world" aria-label="Interactive space playground"></main><header><div class="brand-icon">✳</div><div><h1>Black Hole <span>Toybox</span></h1><p>A little pull. A whole lot of possibility.</p></div></header><div class="top-actions"><button id="pause" aria-label="Pause simulation">Ⅱ <span>Pause</span></button><button id="reset" aria-label="Reset toybox">↺ <span>Reset</span></button></div><div id="hint" role="status">Grab a world. Pull back. Let it fly.</div><footer><section class="tray" aria-label="Add an object"><div class="eyebrow">ADD A LITTLE WONDER</div><div class="spawn-buttons">${Object.entries(TYPES).map(([key, t]) => `<button data-kind="${key}"><i class="toy-icon ${key}"></i>${t.label}<b>+</b></button>`).join('')}</div></section><section class="settings"><label for="pull">Black hole pull <output id="pull-value">Just right</output></label><input id="pull" type="range" min="0.3" max="2.5" step="0.05" value="1"><div class="speed-row"><label for="speed">Time</label><select id="speed"><option value="0.5">Slow & dreamy</option><option value="1" selected>Normal</option><option value="2">Extra speedy</option></select></div></section></footer><div class="camera-hint">Drag empty space to look around · Pinch or scroll to zoom</div>`;
  return {
    host: root.querySelector<HTMLElement>('#world')!,
    bind(spawn: (kind: Kind) => void, pause: () => void, reset: () => void, pull: (n: number) => void, speed: (n: number) => void) {
      root.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(b => b.onclick = () => spawn(b.dataset.kind as Kind));
      root.querySelector<HTMLButtonElement>('#pause')!.onclick = pause; root.querySelector<HTMLButtonElement>('#reset')!.onclick = reset;
      root.querySelector<HTMLInputElement>('#pull')!.oninput = e => { const n = +(e.target as HTMLInputElement).value; root.querySelector('output')!.textContent = n < 0.8 ? 'Gentle' : n > 1.6 ? 'Mighty' : 'Just right'; pull(n); };
      root.querySelector<HTMLSelectElement>('#speed')!.onchange = e => speed(+(e.target as HTMLSelectElement).value);
    },
    hint(text: string) { root.querySelector('#hint')!.textContent = text; },
    paused(p: boolean) { const b = root.querySelector<HTMLButtonElement>('#pause')!; b.innerHTML = p ? '▶ <span>Play</span>' : 'Ⅱ <span>Pause</span>'; b.setAttribute('aria-label', p ? 'Play simulation' : 'Pause simulation'); b.setAttribute('aria-pressed', String(p)); },
    defaults() { root.querySelector<HTMLInputElement>('#pull')!.value = '1'; root.querySelector('output')!.textContent = 'Just right'; root.querySelector<HTMLSelectElement>('#speed')!.value = '1'; },
  };
}
