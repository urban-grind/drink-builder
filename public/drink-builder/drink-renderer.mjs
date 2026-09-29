/** Visual renderer for one Urban Grind drink preview per page. No dependencies. */
export function createDrinkRenderer(svg, options, initial = {}) {
  const find = id => {
    const el = svg.querySelector('#' + id);
    if (!el) throw new Error('Missing drink SVG layer: ' + id);
    return el;
  };
  let state = { base: 'espresso', milk: true, milkType: '2-percent', drizzle: 'none', foam: 'none', dusting: 'none', sauce: 'none', syrups: [] };
  const fields = { base: 'bases', drizzle: 'drizzles', foam: 'foams', dusting: 'dustings', sauce: 'sauces', milkType: 'milks' };
  const baseLayers = [...new Set(Object.values(options.bases).flatMap(b => [b.plain, b.milk]))];
  function flavour(id, selected, choices) {
    const group = find(id), use = group.querySelector('use');
    group.style.display = selected === 'none' ? 'none' : 'inline';
    group.setAttribute('data-option', selected);
    const asset = choices[selected].asset;
    if (asset) use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + asset);
    const filter = choices[selected].filter;
    if (filter) use.setAttribute('filter', `url(#${filter})`);
    else use.removeAttribute('filter');
  }
  function setState(patch) {
    for (const key of Object.keys(patch)) {
      if (key !== 'milk' && key !== 'syrups' && !Object.hasOwn(fields, key)) throw new Error('Unknown drink field: ' + key);
    }
    const next = { ...state, ...patch };
    // New milkType selections take precedence; old boolean recipes still work.
    if (Object.hasOwn(patch, 'milkType')) next.milk = patch.milkType !== 'none';
    else if (Object.hasOwn(patch, 'milk')) {
      if (typeof patch.milk !== 'boolean') throw new Error('milk must be a boolean');
      next.milkType = patch.milk ? (state.milkType === 'none' ? '2-percent' : state.milkType) : 'none';
    }
    if (!Array.isArray(next.syrups) || next.syrups.some(s => !Object.hasOwn(options.syrups, s))) throw new Error('Invalid syrup selection');
    next.syrups = [...new Set(next.syrups)];
    if (typeof next.milk !== 'boolean') throw new Error('milk must be a boolean');
    for (const [field, collection] of Object.entries(fields)) {
      if (!Object.hasOwn(options[collection], next[field])) throw new Error('Invalid ' + field + ': ' + next[field]);
    }
    const active = options.bases[next.base][next.milk ? 'milk' : 'plain'];
    find('mixed-base-alpha-use').setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#asset-' + active);
    baseLayers.forEach(name => { find('base-' + name).style.display = name === active ? 'inline' : 'none'; });
    flavour('caramel-drizzle', next.drizzle, options.drizzles);
    flavour('chocolate-foam', next.foam, options.foams);
    Object.values(options.dustings).forEach(item => {
      if (item.layer) find(item.layer).style.display = item.layer === options.dustings[next.dusting].layer ? 'inline' : 'none';
    });
    const full = next.milk || next.base === 'cold-brew';
    flavour('foam-overflow', next.foam, options.foams);
    if (!full) find('foam-overflow').style.display = 'none';
    const sauce = options.sauces[next.sauce];
    find('mixed-sauce').style.display = next.sauce === 'none' || (next.base === 'none' && !next.milk) ? 'none' : 'inline';
    find('mixed-sauce').setAttribute('clip-path', full ? 'url(#mixed-full-clip)' : 'url(#mixed-low-clip)');
    find('mixed-sauce-tint').setAttribute('fill', sauce.colour);
    find('mixed-sauce-tint').setAttribute('opacity', sauce.opacity);
    find('toppings-position').setAttribute('transform', full ? '' : next.base === 'none'
      ? 'translate(181 1135) scale(.61 .50)' : 'translate(155 951) scale(.67 .67)');
    const names = {
      none: next.milk ? 'Iced milk' : 'Empty cup',
      espresso: next.milk ? 'Iced latte' : 'Double espresso',
      chai: next.milk ? 'Iced chai latte' : 'Chai tea concentrate',
      matcha: next.milk ? 'Iced matcha latte' : 'Matcha concentrate',
      'cold-brew': next.milk ? 'Cold brew with milk' : 'Iced cold brew'
    };
    const description = [names[next.base]];
    if (next.milk) description.push(options.milks[next.milkType].label);
    for (const field of ['sauce', 'drizzle', 'foam', 'dusting']) {
      if (next[field] !== 'none') description.push(options[fields[field]][next[field]].label);
    }
    next.syrups.forEach(s => description.push(options.syrups[s].label + ' syrup'));
    find('drink-title').textContent = description.join(' + ');
    state = next;
    return { ...state, syrups: [...state.syrups] };
  }
  setState(initial);
  return {
    setState,
    getState: () => ({ ...state, syrups: [...state.syrups] }),
    getDescription: () => find('drink-title').textContent,
    toSVG: () => new XMLSerializer().serializeToString(svg)
  };
}

/** Load the bundled, trusted SVG and configuration from your own static folder. */
export async function mountDrinkBuilder(container, assetRoot = './', initial = {}) {
  const root = new URL(assetRoot.endsWith('/') ? assetRoot : assetRoot + '/', document.baseURI);
  const responses = await Promise.all(['drink-master.svg', 'ingredient-options.json'].map(name => fetch(new URL(name, root))));
  for (const response of responses) if (!response.ok) throw new Error(`Drink assets failed to load (${response.status})`);
  const [source, options] = await Promise.all([responses[0].text(), responses[1].json()]);
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') throw new Error('Invalid drink SVG');
  const svg = document.importNode(parsed.documentElement, true);
  const renderer = createDrinkRenderer(svg, options, initial);
  container.replaceChildren(svg);
  return renderer;
}
