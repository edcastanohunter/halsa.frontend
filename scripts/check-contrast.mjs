// WCAG 2.2 AA contrast gate for the design tokens (plan §8.1, M1 AC).
// Parses the OKLCH custom properties of libs/ui/src/theme.css for both themes and checks every
// text/background pair the components use (4.5:1) plus the non-text UI pairs (3:1, WCAG 1.4.11).
import { readFileSync } from 'node:fs';

const THEME_FILE = 'libs/ui/src/theme.css';
const css = readFileSync(THEME_FILE, 'utf8');

function readBlock(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} block not found in ${THEME_FILE}`);
  const body = css.slice(start, css.indexOf('}', start));
  const vars = {};
  for (const [, name, l, c, h] of body.matchAll(
    /--([\w-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g,
  )) {
    vars[name] = [Number(l), Number(c), Number(h)];
  }
  return vars;
}

const light = readBlock(':root');
const themes = { light, dark: { ...light, ...readBlock(':root.dark') } };

// OKLCH -> linear sRGB (Björn Ottosson's OKLab matrices), clamped to the sRGB gamut.
function toLinearRgb([l, c, h]) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((v) => Math.min(1, Math.max(0, v)));
}

const encode = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const decode = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

// Browsers composite alpha in gamma-encoded sRGB.
function over(fgLinear, alpha, bgLinear) {
  return fgLinear.map((v, i) => decode(alpha * encode(v) + (1 - alpha) * encode(bgLinear[i])));
}

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5;
const UI = 3;
const STATUS = ['destructive', 'success', 'warning', 'info', 'clinical'];
// Soft badges and banners: `bg-<status>/12` on a surface, `text-<status>` on top.
const SOFT_ALPHA = 0.12;

const pairs = [
  ['foreground', 'background', TEXT],
  ['card-foreground', 'card', TEXT],
  ['popover-foreground', 'popover', TEXT],
  ['foreground', 'muted', TEXT],
  ['muted-foreground', 'background', TEXT],
  ['muted-foreground', 'card', TEXT],
  ['muted-foreground', 'muted', TEXT],
  ['primary-foreground', 'primary', TEXT],
  ['secondary-foreground', 'secondary', TEXT],
  ['accent-foreground', 'accent', TEXT],
  ['primary', 'background', TEXT],
  ['primary', 'card', TEXT],
  ['primary', { tint: 'primary', on: 'card' }, TEXT],
  ['sidebar-foreground', 'sidebar', TEXT],
  ['sidebar-accent-foreground', 'sidebar-accent', TEXT],
  ...STATUS.flatMap((s) => [
    [`${s}-foreground`, s, TEXT],
    [s, 'background', TEXT],
    [s, 'card', TEXT],
    [s, { tint: s, on: 'card' }, TEXT],
    [s, { tint: s, on: 'background' }, TEXT],
  ]),
  ['input', 'background', UI],
  ['input', 'card', UI],
  ['ring', 'background', UI],
  ['ring', 'card', UI],
];

let failures = 0;
for (const [theme, vars] of Object.entries(themes)) {
  console.log(`${theme}:`);
  const color = (name) => {
    if (!vars[name]) throw new Error(`--${name} missing in ${theme}`);
    return toLinearRgb(vars[name]);
  };
  for (const [fg, bg, min] of pairs) {
    const bgColor =
      typeof bg === 'string' ? color(bg) : over(color(bg.tint), SOFT_ALPHA, color(bg.on));
    const bgName = typeof bg === 'string' ? bg : `${bg.tint}/${SOFT_ALPHA * 100} on ${bg.on}`;
    const value = ratio(color(fg), bgColor);
    const ok = value >= min;
    if (!ok) failures++;
    const line = `  ${ok ? '✓' : '✗'} ${fg} on ${bgName}: ${value.toFixed(2)} (min ${min})`;
    if (ok) {
      console.log(line);
    } else {
      console.error(line);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} pair(s) below WCAG 2.2 AA.`);
  process.exit(1);
}
console.log('\nAll token pairs meet WCAG 2.2 AA.');
