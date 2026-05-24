function safeText(value){ return value === undefined || value === null ? '' : String(value); }
function setText(id, text){ const el = document.getElementById(id); if(el) el.textContent = safeText(text); }
function normalizeComponentName(name){ return safeText(name).replace(/\s*\([^)]*\)\s*$/, '').trim(); }
const CATEGORY_ORDER = ['Electrical','Mechanical','Structural','Mixed / Other'];
function deriveCategory(component){ const text = `${component.name} ${component.function} ${component.material}`.toLowerCase();
  if(/\b(switch|wire|capacitor|transformer|coil|brush|speaker|magnet|armature|commutator|current|electrical|voltage|signal|power|battery|motor|antenna|copper|carbon)\b/.test(text)) return 'Electrical';
  if(/\b(air|impeller|gear|spring|bearing|movement|motion|shaft|rotor|nozzle|director|chamber|carrier)\b/.test(text)) return 'Mechanical';
  if(/\b(housing|chassis|frame|cover|grill|support|board|plate|base|shell|casing|panel|mount)\b/.test(text)) return 'Structural';
  return 'Mixed / Other';
}
function deriveRelation(component){ const text = `${component.name} ${component.function} ${component.material}`.toLowerCase();
  if(/\b(heat|thermal|coil|mica|heater)\b/.test(text)) return 'Thermal subsystem';
  if(/\b(air|impeller|nozzle|director|chamber)\b/.test(text)) return 'Airflow subsystem';
  if(/\b(switch|wire|capacitor|transformer|power|current|button|plug|antenna|signal)\b/.test(text)) return 'Electrical subsystem';
  if(/\b(frame|housing|chassis|support|grill|base|case|shell|board)\b/.test(text)) return 'Structural subsystem';
  return 'General subsystem';
}
function buildMaterialDistribution(components){ const counts = {}; let total = 0;
  const splitRE = /\s*(?:\/|,|;|&|\+|\band\b)\s*/i;
  components.forEach(c => {
    const tokens = String(c.material || 'Unknown').split(splitRE).map(t => t.trim()).filter(Boolean);
    if(!tokens.length){ counts.Unknown = (counts.Unknown || 0) + 1; total += 1; }
    tokens.forEach(token => { counts[token] = (counts[token] || 0) + 1; total += 1; });
  });
  return Object.entries(counts).sort((a,b) => b[1] - a[1]).map(([material,count]) => ({ material, count, percent: Math.round((count / total) * 100), ratio: count / total }));
}
function buildCategoryCounts(components){ const counts = CATEGORY_ORDER.reduce((acc, category) => { acc[category] = 0; return acc; }, { 'Mixed / Other': 0 });
  components.forEach(c => { counts[c.category] = (counts[c.category] || 0) + 1; });
  return Object.entries(counts).map(([category, count]) => ({ category, count })).filter(item => item.count > 0);
}
function transformReportData(raw){ const components = Array.isArray(raw.components) ? raw.components.map(c => ({
      ...c,
      cleanedName: normalizeComponentName(c.name),
      category: deriveCategory(c),
      relation: deriveRelation(c),
      cleanedFunction: safeText(c.function).replace(/\s+/g,' ').trim()
    })) : [];
  const sortedComponents = components.slice().sort((a,b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    if(ca !== cb) return ca - cb;
    return a.part.toString().localeCompare(b.part.toString(), undefined, { numeric: true });
  });
  const grouped = CATEGORY_ORDER.reduce((acc, category) => { acc[category] = []; return acc; }, {});
  sortedComponents.forEach(c => { grouped[c.category] = grouped[c.category] || []; grouped[c.category].push(c); });
  return {
    components: sortedComponents,
    groupedComponents: grouped,
    categoryCounts: buildCategoryCounts(sortedComponents),
    materialDistribution: buildMaterialDistribution(sortedComponents),
    categoryOrder: CATEGORY_ORDER
  };
}
function renderData(data){ if(!data){ return; }
  const view = transformReportData(data);
  setText('hero-title', data.title);
  setText('hero-subtitle', data.subtitle);
  setText('hero-description', data.summary);

  const objectives = document.getElementById('objectives-list');
  if(objectives && Array.isArray(data.objectives)){
    objectives.innerHTML = data.objectives.map(item => `<li class="objective-item"><strong>${safeText(item)}</strong></li>`).join('');
  }

  const workflow = document.getElementById('workflow-list');
  if(workflow && Array.isArray(data.system_workflow)){
    workflow.innerHTML = data.system_workflow.map(item => {
      const parts = String(item).split(':');
      return `<li class="workflow-item"><strong>${safeText(parts[0] || item)}:</strong> ${safeText(parts[1] || '')}</li>`;
    }).join('');
  }

  const materialsTable = document.getElementById('materials-table-body');
  if(materialsTable && data.materials_summary){
    materialsTable.innerHTML = Object.entries(data.materials_summary).map(([material, rationale]) => `<tr><td>${safeText(material)}</td><td>${safeText(rationale)}</td></tr>`).join('');
  }

  setText('component-count', view.components.length);
  setText('manufacturing-stages-count', Array.isArray(data.manufacturing_processes) ? data.manufacturing_processes.length : (Array.isArray(data.manufacturing_consolidated) ? data.manufacturing_consolidated.length : 0));
  setText('material-families-count', view.materialDistribution.length);

  const disassemblyBody = document.getElementById('disassembly-body');
  if(disassemblyBody && Array.isArray(data.disassembly_components)){
    disassemblyBody.innerHTML = data.disassembly_components.map(item => `<tr><td>${safeText(item.part)}</td><td>${safeText(item.name)}</td><td>${safeText(item.function)}</td><td>${safeText(item.role)}</td></tr>`).join('');
  }

  const materialIdentificationBody = document.getElementById('material-identification-body');
  if(materialIdentificationBody){
    if(Array.isArray(data.materials_identification) && data.materials_identification.length){
      materialIdentificationBody.innerHTML = data.materials_identification.map(item => `<tr><td>${safeText(item.part)}</td><td>${safeText(item.method)}</td><td>${safeText(item.justification)}</td><td>${safeText(item.material)}</td></tr>`).join('');
    } else {
      materialIdentificationBody.innerHTML = `<tr><td colspan="4">Data unavailable from report</td></tr>`;
    }
  }

  const materialsChart = document.getElementById('materials-chart');
  if(materialsChart){
    if(view.materialDistribution.length){
      const palette = ['#38bdf8','#818cf8','#f472b6','#34d399','#facc15','#fb7185','#60a5fa','#a78bfa'];
      let cumulative = 0;
      const gradient = view.materialDistribution.map((item,index) => {
        const color = palette[index % palette.length];
        const start = cumulative;
        cumulative += (item.ratio * 100);
        return `${color} ${start}% ${cumulative}%`;
      }).join(', ');
      const legend = view.materialDistribution.map((item,index) => `<div class="pie-legend-item"><span class="pie-legend-swatch" style="background:${palette[index % palette.length]}"></span><strong>${safeText(item.material)}</strong>: ${safeText(item.percent)}%</div>`).join('');
      materialsChart.innerHTML = `<div class="pie-wheel" style="background:conic-gradient(${gradient});"></div><div class="pie-legend">${legend}</div>`;
    } else {
      materialsChart.innerHTML = `<div class="fallback-panel">Data unavailable from report</div>`;
    }
  }

  const componentCategoryChart = document.getElementById('component-category-chart');
  if(componentCategoryChart){
    if(view.categoryCounts.length){
      const maxCount = Math.max(...view.categoryCounts.map(item => item.count), 1);
      componentCategoryChart.innerHTML = view.categoryCounts.map(item => {
        const width = Math.round((item.count / maxCount) * 100);
        return `<div class="category-bar-row"><div><div class="category-label">${safeText(item.category)}</div><div class="category-bar-track"><div class="category-bar-fill" style="width:${width}%"></div></div></div><div class="category-count">${safeText(item.count)}</div></div>`;
      }).join('');
    } else {
      componentCategoryChart.innerHTML = `<div class="fallback-panel">Data unavailable from report</div>`;
    }
  }

  const materialMappingBody = document.getElementById('material-mapping-body');
  if(materialMappingBody){
    const knownMaterials = data.materials_summary ? Object.keys(data.materials_summary).map(m => m.trim()) : [];
    const mapping = {};
    if(knownMaterials.length){ knownMaterials.forEach(m => mapping[m] = []); }
    const splitRE = /\s*(?:\/|,|;|&| and |\+)\s*/i;
    if(Array.isArray(data.components) && data.components.length){
      data.components.forEach(c => {
        const raw = String(c.material || 'Unknown').trim();
        const tokens = raw.split(splitRE).map(t => t.trim()).filter(Boolean);
        tokens.forEach(token => {
          const exact = knownMaterials.find(k => k.toLowerCase() === token.toLowerCase());
          if(exact){ mapping[exact] = mapping[exact] || []; mapping[exact].push(`${c.part || ''} ${c.name || ''}`.trim()); return; }
          const includes = knownMaterials.find(k => k.toLowerCase().includes(token.toLowerCase()) || token.toLowerCase().includes(k.toLowerCase()));
          if(includes){ mapping[includes] = mapping[includes] || []; mapping[includes].push(`${c.part || ''} ${c.name || ''}`.trim()); return; }
          mapping[token] = mapping[token] || []; mapping[token].push(`${c.part || ''} ${c.name || ''}`.trim());
        });
        if(!tokens.length){ mapping['Unknown'] = mapping['Unknown'] || []; mapping['Unknown'].push(`${c.part || ''} ${c.name || ''}`.trim()); }
      });
    }
    const rows = (knownMaterials.length ? knownMaterials.concat(Object.keys(mapping).filter(k => !knownMaterials.includes(k))) : Object.keys(mapping)).map(material => {
      const names = mapping[material] || [];
      return `<tr><td>${safeText(material)}</td><td>${safeText(names.join(', ')) || '—'}</td></tr>`;
    });
    materialMappingBody.innerHTML = rows.length ? rows.join('') : `<tr><td colspan="2">Data unavailable from report</td></tr>`;
  }

  const manufacturingDetailsBody = document.getElementById('manufacturing-details-body');
  if(manufacturingDetailsBody){
    if(Array.isArray(data.manufacturing_processes) && data.manufacturing_processes.length){
      manufacturingDetailsBody.innerHTML = data.manufacturing_processes.map(item => `<tr><td>${safeText(item.part)}</td><td>${safeText((item.steps || []).join(' → '))}</td><td>${safeText(item.notes || '')}</td></tr>`).join('');
    } else {
      manufacturingDetailsBody.innerHTML = `<tr><td colspan="3">Data unavailable from report</td></tr>`;
    }
  }

  const componentsGrid = document.getElementById('components-grid');
  if(componentsGrid){
    if(view.components.length){
      componentsGrid.innerHTML = view.categoryOrder.map(category => {
        const items = view.groupedComponents[category] || [];
        if(!items.length) return '';
        return `<div class="component-group"><h3>${category} Components <span class="category-badge">${items.length}</span></h3>${items.map(c => `<div class="card component-card"><div class="category-badge">${safeText(c.category)}</div><h4>${safeText(c.part || '')}${c.part ? ' — ' : ''}${safeText(c.cleanedName)}</h4><p><strong>Relation:</strong> ${safeText(c.relation)}</p><p><strong>Function:</strong> ${safeText(c.cleanedFunction)}</p><p><strong>Material:</strong> ${safeText(c.material)}</p><p><strong>Manufacturing:</strong> ${safeText(c.manufacturing)}</p></div>`).join('')}</div>`;
      }).join('');
    } else {
      componentsGrid.innerHTML = `<div class="card card-compact">Data unavailable from report</div>`;
    }
  }

  const conclusionsList = document.getElementById('conclusions-list');
  if(conclusionsList && Array.isArray(data.conclusions)){
    conclusionsList.innerHTML = data.conclusions.map(item => `<li class="workflow-item">${safeText(item)}</li>`).join('');
  }

  const reportNotes = document.getElementById('report-notes');
  if(reportNotes){ setText('report-notes', data.notes || 'No additional notes were included in the report source.'); }

  const teamNote = document.getElementById('team-note');
  if(teamNote){
    if(Array.isArray(data.team) && data.team.length){ teamNote.textContent = data.team.join(', '); }
    else { teamNote.textContent = 'No team details were provided in the report source.'; }
  }
}
function renderMermaidDiagrams(data){ const architecture = document.getElementById('architecture-graph');
  if(architecture && Array.isArray(data.system_workflow)){
    const lines = ['graph TD', 'SYS[System Structure]'];
    data.system_workflow.forEach((item, index) => {
      const label = safeText(String(item).split(':')[0] || item);
      lines.push(`W${index}[${label}]`);
      lines.push(`SYS --> W${index}`);
    });
    architecture.textContent = lines.join('\n');
  }

  const componentMaterial = document.getElementById('component-material-graph');
  if(componentMaterial && Array.isArray(data.components)){
    const lines = ['graph LR'];
    const categories = new Map();
    data.components.forEach((component, index) => {
      const category = deriveCategory(component);
      if(!categories.has(category)){
        const catId = `G${categories.size}`;
        categories.set(category, catId);
        lines.push(`${catId}[${safeText(category)}]`);
      }
      const nodeId = `C${index}`;
      const materialId = `M${index}`;
      lines.push(`${nodeId}[${safeText(component.name)}]`);
      lines.push(`${categories.get(category)} --> ${nodeId}`);
      lines.push(`${nodeId} --> ${materialId}[${safeText(component.material)}]`);
    });
    componentMaterial.textContent = lines.join('\n');
  }

  const manufacturing = document.getElementById('manufacturing-graph');
  const stages = Array.isArray(data.manufacturing_consolidated) && data.manufacturing_consolidated.length ? data.manufacturing_consolidated : (Array.isArray(data.manufacturing_processes) ? data.manufacturing_processes.map(item => safeText((item.steps || []).join(' → '))) : []);
  if(manufacturing && stages.length){
    const lines = ['graph TB', 'Start([Raw material staging])'];
    stages.forEach((item, index) => {
      const title = safeText(String(item).split(':')[0] || item);
      lines.push(`M${index}[${title}]`);
      lines.push(`${index === 0 ? 'Start' : `M${index - 1}`} --> M${index}`);
    });
    manufacturing.textContent = lines.join('\n');
  }

  if(window.mermaid && !window.mermaidDisabled){ try{ mermaid.initialize({startOnLoad:false, theme:'neutral'}); mermaid.init(undefined, document.querySelectorAll('.mermaid')); } catch(err){ console.warn('Mermaid initialization failed', err); } }
}
function bindHeroControls(){ const button = document.getElementById('mute-toggle'); const iframe = document.getElementById('hero-video'); if(!button || !iframe) return;
  let muted = true;
  button.addEventListener('click', () => {
    muted = !muted;
    const base = 'https://www.youtube.com/embed/iZSwlZ-T_e8?autoplay=1&loop=1&playlist=iZSwlZ-T_e8&controls=0&modestbranding=1&rel=0&showinfo=0';
    iframe.src = `${base}${muted ? '&mute=1' : ''}`;
    button.textContent = muted ? 'Unmute' : 'Mute';
  });
}
function initScrollReveal(){ const items = document.querySelectorAll('[data-reveal]');
  if(!items.length) return;
  if('IntersectionObserver' in window){
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){ entry.target.classList.add('reveal'); obs.unobserve(entry.target); }
      });
    }, {threshold: 0.16});
    items.forEach(item => observer.observe(item));
  } else {
    items.forEach(item => item.classList.add('reveal'));
  }
}
const REPORT_CACHE_KEY = 'mdp181-report-cache';
const REPORT_URLS = (() => {
  const urls = new Set();
  try { urls.add(new URL('data/report.json', window.location.href).href); } catch(e) {}
  try { urls.add(new URL('./data/report.json', window.location.href).href); } catch(e) {}
  if(window.location.origin){ urls.add(`${window.location.origin}/data/report.json`); }
  return Array.from(urls);
})();
function logDebug(message){ console.debug(`[Report] ${message}`); }
function showError(message){ const banner = document.getElementById('error-banner'); if(!banner) return; banner.textContent = message; banner.classList.add('visible'); setTimeout(() => banner.classList.remove('visible'), 8000); }
function safeParseJSON(text){ try{ logDebug('Parsing report...'); const data = JSON.parse(text); logDebug('Parsing success'); return data; } catch(err){ throw new Error(`JSON parse failed: ${err.message}`); } }
async function fetchReportText(url){ logDebug(`Fetching report from ${url}`); const response = await fetch(url, { cache: 'no-store' }); if(!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`); logDebug('Report fetched successfully'); const text = await response.text(); if(!text || !text.trim()) throw new Error('Empty report response'); return text; }
function saveReportCache(text){ try{ localStorage.setItem(REPORT_CACHE_KEY, text); localStorage.setItem(`${REPORT_CACHE_KEY}-ts`, String(Date.now())); logDebug('Report cache updated'); } catch(err){ console.warn('Report cache save failed', err); } }
function loadReportCache(){ try{ const text = localStorage.getItem(REPORT_CACHE_KEY); if(!text) return null; const data = safeParseJSON(text); logDebug('Loaded report from cache'); return data; } catch(err){ console.warn('Cached report parse failed', err); return null; } }
function loadFallbackReport(){ if(window.__REPORT_FALLBACK__ && typeof window.__REPORT_FALLBACK__ === 'object'){ logDebug('Using embedded fallback report data'); return window.__REPORT_FALLBACK__; } return null; }
async function loadLiveReport(){ let lastError;
  for(const url of REPORT_URLS){
    try{
      const text = await fetchReportText(url);
      const data = safeParseJSON(text);
      saveReportCache(text);
      return data;
    } catch(err){
      lastError = err;
      logDebug(`Report fetch attempt failed for ${url}: ${err.message}`);
    }
  }
  throw lastError || new Error('Unable to load report from configured sources');
}
async function initialize(){ bindHeroControls(); initScrollReveal(); const cached = loadReportCache(); if(cached){ renderData(cached); renderMermaidDiagrams(cached); logDebug('Rendered cached report content while live sync occurs.'); }
  try{
    const data = await loadLiveReport(); renderData(data); renderMermaidDiagrams(data); }
  catch(err){ console.warn('Report sync failed', err);
    const fallback = loadFallbackReport();
    if(fallback){ renderData(fallback); renderMermaidDiagrams(fallback); saveReportCache(JSON.stringify(fallback)); showError('Report sync failed — using embedded fallback data.'); }
    else if(cached){ showError(`Report sync failed — using cached content. ${err.message}`); }
    else { showError(`Report sync failed — using static content. ${err.message}`); }
  }
}
window.addEventListener('DOMContentLoaded', initialize);
window.addEventListener('error', () => showError('A non-critical feature failed. Content remains available.'));
