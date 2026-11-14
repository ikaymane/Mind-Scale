/**
 * NIRAN 3D globe (three.js, no React).
 * - Earth: NASA GIBS Blue Marble (shaded relief + bathymetry) + Coastlines_15m (2K first, then 8K).
 * - Fire cells: real MODIS detections in 0.5° cells (globe_cells.json) for the chosen period.
 * - Fuel: MODIS land cover (forest / shrub mask) fades in when zoomed.
 * - Terra and Aqua (the two MODIS satellites) on illustrative polar orbits that turn WITH the Earth;
 *   their swath lights up the fire cells it passes over.
 * - Replay: fire cells appear on the first day they burned; new starts flash as rings.
 * - Live: open wildfires from NASA EONET.
 */
import * as THREE from 'three';

const D2R = Math.PI / 180;
const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&SRS=EPSG:4326&STYLES=';
const GIBS = `${GIBS_BASE}&BBOX=-180,-90,180,90`;
const day = (w: number) => `${GIBS}&LAYERS=BlueMarble_ShadedRelief_Bathymetry&FORMAT=image/jpeg&WIDTH=${w}&HEIGHT=${w / 2}`;
const coast = (w: number) => `${GIBS}&LAYERS=Coastlines_15m&FORMAT=image/png&TRANSPARENT=TRUE&WIDTH=${w}&HEIGHT=${w / 2}`;

const ORBIT_R = 1.3;
const SWATH = 8 * D2R;
const COS_SWATH = Math.cos(SWATH);
const DIST_GLOBAL = 4.4;
const SPIN = 0.012; // rad/s when idle
const ORBIT_REV_S = 0.018; // satellite revolutions per second (~55 s an orbit)
const CELL_WORLD = 0.5 * D2R; // a 0.5° cell on the unit sphere

export function llToVec(lat: number, lon: number, r = 1) {
  const la = lat * D2R, lo = lon * D2R;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}
export function vecToLL(v: THREE.Vector3) {
  const n = v.clone().normalize();
  return { lat: Math.asin(n.y) / D2R, lon: Math.atan2(-n.z, n.x) / D2R };
}

export interface GlobeRegion { id: string; center: [number, number]; bbox: [number, number, number, number] }
export interface GlobeCells { step: number; years: number[]; regions: string[]; cells: number[][] }
export interface SatInfo { name: string; lat: number; lon: number; inSwath: number }
export interface ReplayInfo { day: number; days: number; playing: boolean; burning: number; newToday: number }
export interface LiveEvent { lat: number; lon: number; title: string }

interface Options {
  reducedMotion: boolean;
  forestMaskUrl: string;
  onPick: (regionId: string) => void;
  onSatInfo?: (info: SatInfo[]) => void;
  onReplay?: (info: ReplayInfo | null) => void;
  onZoom?: (zoomed: boolean) => void;
}

interface Sat { name: string; plane: THREE.Group; body: THREE.Group; ring: THREE.Mesh; beamMat: THREE.ShaderMaterial; phase: number; inSwath: number; sub: THREE.Vector3 }

export class GlobeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
  private earth = new THREE.Group();
  private globe: THREE.Mesh;
  private forestMat: THREE.MeshBasicMaterial;
  private forestRequested = false;
  private patch?: { group: THREE.Group; mats: THREE.MeshBasicMaterial[]; loaded: boolean[] };
  private points?: THREE.Points;
  private pointMat?: THREE.ShaderMaterial;
  private events?: THREE.Points;
  private cellVec = new Float32Array(0);
  private cellCount = new Float32Array(0);
  private cellStart = new Float32Array(0);
  private cellRegion = new Int16Array(0);
  private cells: GlobeCells | null = null;
  private sats: Sat[] = [];
  private regions: GlobeRegion[] = [];
  private labels = new Map<string, { el: HTMLElement; anchor: THREE.Vector3 }>();
  private satLabels = new Map<string, HTMLElement>();

  private yaw = -1.2; private pitch = 0.3; private dist = DIST_GLOBAL;
  private tYaw = -1.2; private tPitch = 0.3; private tDist = DIST_GLOBAL;
  private focused: string | null = null;
  private zoomed = false;
  private time = 0;
  private last = performance.now();
  private raf = 0;
  private visible = true;
  private ptrs = new Map<number, { x: number; y: number }>();
  private down: { x: number; y: number; moved: number } | null = null;
  private pinch0 = 0;
  private infoTick = 0;
  private aspectK = 1;
  private recent?: THREE.Points;
  private replay: { day: number; days: number; playing: boolean; lastSent: number } | null = null;
  private ro: ResizeObserver;
  private io: IntersectionObserver;

  constructor(private host: HTMLElement, private opts: Options) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'globe-canvas';
    host.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xbfd4ff, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(4, 2.5, 5);
    this.scene.add(sun);

    // --- Earth ---
    this.scene.add(this.earth);
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const globeMat = new THREE.MeshBasicMaterial({ color: 0x9db3c9 });
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), globeMat);
    this.earth.add(this.globe);
    const coastMat = new THREE.MeshBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0, depthWrite: false });
    this.earth.add(new THREE.Mesh(new THREE.SphereGeometry(1.0012, 128, 96), coastMat));
    this.loadProgressive([day(2048), day(8192)], (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
      globeMat.map?.dispose(); globeMat.map = tex; globeMat.color.set(0xffffff); globeMat.needsUpdate = true;
    });
    this.loadProgressive([coast(4096), coast(8192)], (tex) => {
      tex.anisotropy = aniso;
      coastMat.map?.dispose(); coastMat.map = tex; coastMat.opacity = 0.45; coastMat.needsUpdate = true;
    });
    // fuel layer (MODIS land cover), loaded on first zoom
    this.forestMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const forest = new THREE.Mesh(new THREE.SphereGeometry(1.0006, 128, 96), this.forestMat);
    forest.renderOrder = 1;
    this.earth.add(forest);
    this.earth.add(this.makeGraticule());
    this.scene.add(this.makeAtmosphere());

    // --- Terra (descending ~10:30) and Aqua (ascending ~13:30), riding with the Earth ---
    this.sats.push(this.makeSat('Terra', 98.2, 62, 0.4));
    this.sats.push(this.makeSat('Aqua', 98.2, 128, Math.PI + 0.7));

    this.bindInput();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; });
    this.io.observe(host);
    document.addEventListener('visibilitychange', this.onVis);
    this.resize();
    this.loop();
  }

  // ---------------------------------------------------------------- building
  private loadProgressive(urls: string[], apply: (t: THREE.Texture) => void) {
    const loader = new THREE.TextureLoader().setCrossOrigin('anonymous');
    let best = -1;
    urls.forEach((u, i) => loader.load(u, (tex) => {
      if (i < best) { tex.dispose(); return; }
      best = i; apply(tex);
    }));
  }

  private makeGraticule() {
    const pts: number[] = [];
    const push = (a: THREE.Vector3, b: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    for (let lat = -75; lat <= 75; lat += 15)
      for (let lon = -180; lon < 180; lon += 2) push(llToVec(lat, lon, 1.002), llToVec(lat, lon + 2, 1.002));
    for (let lon = -180; lon < 180; lon += 15)
      for (let lat = -88; lat < 88; lat += 2) push(llToVec(lat, lon, 1.002), llToVec(lat + 2, lon, 1.002));
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
  }

  private makeAtmosphere() {
    const g = new THREE.Group();
    const vs = `varying vec3 vN; varying vec3 vP;
      void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vP = mv.xyz; gl_Position = projectionMatrix * mv; }`;
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1.01, 96, 64), new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexShader: vs,
      fragmentShader: `varying vec3 vN; varying vec3 vP;
        void main(){ float f = pow(1.0 - max(dot(vN, normalize(-vP)), 0.0), 4.0); gl_FragColor = vec4(vec3(0.55, 0.78, 1.0) * f * 0.5, f * 0.5); }`,
    })));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1.15, 96, 64), new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, vertexShader: vs,
      fragmentShader: `varying vec3 vN; varying vec3 vP;
        void main(){ float f = pow(max(-dot(vN, normalize(-vP)), 0.0), 3.0); gl_FragColor = vec4(vec3(0.3, 0.55, 0.95) * f * 0.35, f * 0.35); }`,
    })));
    return g;
  }

  private makeSat(name: string, inclDeg: number, raanDeg: number, phase: number): Sat {
    const plane = new THREE.Group();
    plane.rotation.y = raanDeg * D2R;
    const tilt = new THREE.Group();
    tilt.rotation.x = inclDeg * D2R;
    plane.add(tilt);
    this.earth.add(plane);

    const orbitPts: number[] = [];
    for (let i = 0; i <= 256; i++) { const u = (i / 256) * Math.PI * 2; orbitPts.push(ORBIT_R * Math.cos(u), 0, -ORBIT_R * Math.sin(u)); }
    tilt.add(new THREE.Line(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(orbitPts, 3)),
      new THREE.LineDashedMaterial({ color: 0x0b3d91, transparent: true, opacity: 0.35, dashSize: 0.025, gapSize: 0.02 }),
    ).computeLineDistances());

    const body = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8b25a, metalness: 0.85, roughness: 0.32, emissive: 0x3a2a08, emissiveIntensity: 0.4 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1c3a78, metalness: 0.6, roughness: 0.35, emissive: 0x0b1e4a, emissiveIntensity: 0.6 });
    const frame = new THREE.MeshStandardMaterial({ color: 0xcfd6e0, metalness: 0.9, roughness: 0.3 });
    body.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.04), gold));
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.026, 6), frame);
      arm.rotation.z = Math.PI / 2; arm.position.x = s * 0.028; body.add(arm);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.0014, 0.026), panelMat);
      panel.position.x = s * 0.074; body.add(panel);
    }
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.009, 12), new THREE.MeshBasicMaterial({ color: 0x9be7ff }));
    lens.rotation.x = Math.PI / 2; lens.position.z = 0.024; body.add(lens);
    tilt.add(body);

    const h = ORBIT_R - 1 + 0.004;
    const footR = Math.sin(SWATH);
    const coneGeo = new THREE.ConeGeometry(footR, h, 48, 1, true);
    coneGeo.rotateX(-Math.PI / 2);
    coneGeo.translate(0, 0, h / 2);
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform float uTime; uniform float uFade; varying vec2 vUv;
        void main(){
          float base = pow(1.0 - vUv.y, 1.6) * 0.16;
          float sweep = smoothstep(0.93, 1.0, fract(vUv.y - uTime * 0.6)) * 0.3 * (1.0 - vUv.y);
          gl_FragColor = vec4(vec3(0.04, 0.24, 0.57), (base + sweep) * 1.6 * uFade);
        }`,
    });
    body.add(new THREE.Mesh(coneGeo, beamMat));

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(footR * 0.93, footR, 96),
      new THREE.MeshBasicMaterial({ color: 0x0b3d91, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.earth.add(ring);
    return { name, plane, body, ring, beamMat, phase, inSwath: 0, sub: new THREE.Vector3() };
  }

  // ---------------------------------------------------------------- data
  setCells(cells: GlobeCells) {
    this.cells = cells;
    const n = cells.cells.length;
    const pos = new Float32Array(n * 3);
    this.cellVec = new Float32Array(n * 3);
    this.cellCount = new Float32Array(n);
    this.cellStart = new Float32Array(n);
    this.cellRegion = new Int16Array(n);
    cells.cells.forEach((c, i) => {
      const v = llToVec(c[0], c[1], 1);
      this.cellVec.set([v.x, v.y, v.z], i * 3);
      pos.set([v.x * 1.003, v.y * 1.003, v.z * 1.003], i * 3);
      this.cellRegion[i] = c[2];
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    for (const [name, fill] of [['aI', 0], ['aScan', -100], ['aFocus', 1], ['aStart', 0]] as const)
      geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n).fill(fill), 1));
    this.pointMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, premultipliedAlpha: true,
      uniforms: { uTime: { value: 0 }, uPR: { value: this.renderer.getPixelRatio() }, uProj: { value: 800 }, uDay: { value: 999 } },
      vertexShader: `attribute float aI; attribute float aScan; attribute float aFocus; attribute float aStart;
        uniform float uTime; uniform float uPR; uniform float uProj; uniform float uDay;
        varying float vGlow; varying float vFacing; varying float vFocus; varying float vI; varying float vIgnite;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * position);
          vFacing = dot(n, normalize(-mv.xyz));
          float since = uTime - aScan;
          vGlow = since < 0.0 ? 0.0 : exp(-since * 0.7);
          vFocus = aFocus; vI = aI;
          float age = uDay - aStart;
          vIgnite = (uDay < 900.0 && age >= 0.0 && age < 1.6) ? 1.0 - age / 1.6 : 0.0;
          bool hidden = aI <= 0.0 || (uDay < 900.0 && age < 0.0);
          float px = max((2.4 + 3.2 * aI) * uPR, uProj * ${CELL_WORLD.toFixed(5)} * (0.55 + 0.5 * aI) / -mv.z);
          gl_PointSize = hidden ? 0.0 : px * (1.0 + 0.5 * vGlow + 1.8 * vIgnite);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vGlow; varying float vFacing; varying float vFocus; varying float vI; varying float vIgnite;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float r = d * (1.0 + 1.8 * vIgnite);
          float core = 1.0 - smoothstep(0.36, 0.46, r);
          vec3 col = mix(vec3(0.72, 0.07, 0.03), vec3(1.0, 0.42, 0.0), vI);
          col = mix(col, vec3(1.0, 0.86, 0.3), vGlow * 0.7);
          float ring = vIgnite * (1.0 - smoothstep(0.02, 0.05, abs(d - (0.5 - 0.22 * vIgnite))));
          float front = smoothstep(-0.05, 0.2, vFacing);
          float a = max(core * (0.78 + 0.22 * vGlow), ring) * mix(0.08, 1.0, front) * mix(0.22, 1.0, vFocus);
          vec3 c = mix(col, vec3(0.6, 0.0, 0.0), ring);
          gl_FragColor = vec4(c * a, a);
        }`,
    });
    if (this.points) {  // sensor switch: replace the previous cloud and free its GPU buffers
      this.earth.remove(this.points);
      this.points.geometry.dispose();
      (this.points.material as THREE.Material).dispose();
    }
    this.points = new THREE.Points(geo, this.pointMat);
    this.points.renderOrder = 2;
    this.earth.add(this.points);
    this.resize();
  }

  setPeriod(year: number, month: number | null) {
    if (!this.cells || !this.points) return;
    const yi = this.cells.years.indexOf(year);
    const geo = this.points.geometry;
    const aI = geo.getAttribute('aI') as THREE.BufferAttribute;
    const aStart = geo.getAttribute('aStart') as THREE.BufferAttribute;
    let max = 1;
    this.cells.cells.forEach((c, i) => {
      let n = 0, start = 99;
      if (yi >= 0) for (let j = 3; j + 2 < c.length; j += 3) {
        const k = c[j];
        if (month === null ? Math.floor(k / 12) === yi : k === yi * 12 + month - 1) { n += c[j + 1]; start = Math.min(start, c[j + 2]); }
      }
      this.cellCount[i] = n;
      this.cellStart[i] = start;
      if (n > max) max = n;
    });
    const lm = Math.log10(1 + max);
    for (let i = 0; i < this.cellCount.length; i++) {
      aI.setX(i, this.cellCount[i] > 0 ? Math.max(0.02, Math.log10(1 + this.cellCount[i]) / lm) : 0);
      aStart.setX(i, this.cellStart[i]);
    }
    aI.needsUpdate = true; aStart.needsUpdate = true;
    this.stopReplay();
  }

  setRegions(regions: GlobeRegion[]) { this.regions = regions; }

  setLabel(id: string, el: HTMLElement | null) {
    if (!el) { this.labels.delete(id); return; }
    const r = this.regions.find((x) => x.id === id);
    if (r) this.labels.set(id, { el, anchor: llToVec(r.center[0], r.center[1], 1.01) });
  }
  setSatLabel(name: string, el: HTMLElement | null) { if (el) this.satLabels.set(name, el); else this.satLabels.delete(name); }

  /** NASA EONET open wildfires */
  setEvents(list: LiveEvent[], visible: boolean) {
    if (this.events) { this.earth.remove(this.events); this.events.geometry.dispose(); }
    if (!list.length) return;
    const pos = new Float32Array(list.length * 3);
    list.forEach((e, i) => { const v = llToVec(e.lat, e.lon, 1.004); pos.set([v.x, v.y, v.z], i * 3); });
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, premultipliedAlpha: true,
      uniforms: { uTime: { value: 0 }, uPR: { value: this.renderer.getPixelRatio() } },
      vertexShader: `uniform float uPR; varying float vFacing;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vFacing = dot(normalize(normalMatrix*position), normalize(-mv.xyz)); gl_PointSize = 18.0 * uPR; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; varying float vFacing;
        void main(){
          vec2 p = gl_PointCoord - 0.5; float d = length(p);
          float t = fract(uTime * 0.6);
          float ring = (1.0 - smoothstep(0.0, 0.05, abs(d - 0.12 - 0.36 * t))) * (1.0 - t);
          float dot_ = 1.0 - smoothstep(0.08, 0.12, d);
          float a = max(ring * 0.9, dot_) * smoothstep(0.0, 0.2, vFacing);
          vec3 c = mix(vec3(0.62, 0.0, 0.22), vec3(1.0), 1.0 - smoothstep(0.03, 0.06, d));
          gl_FragColor = vec4(c * a, a);
        }`,
    });
    this.events = new THREE.Points(geo, mat);
    this.events.renderOrder = 3;
    this.events.visible = visible;
    this.earth.add(this.events);
  }
  setEventsVisible(v: boolean) { if (this.events) this.events.visible = v; if (this.recent) this.recent.visible = v; }

  /** Near-real-time detections of the last days (NASA GIBS): small crimson dots */
  setRecent(list: { lat: number; lon: number }[], visible: boolean) {
    if (this.recent) { this.earth.remove(this.recent); this.recent.geometry.dispose(); this.recent = undefined; }
    if (!list.length) return;
    const pos = new Float32Array(list.length * 3);
    list.forEach((e, i) => { const v = llToVec(e.lat, e.lon, 1.0045); pos.set([v.x, v.y, v.z], i * 3); });
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, premultipliedAlpha: true,
      uniforms: { uPR: { value: this.renderer.getPixelRatio() } },
      vertexShader: `uniform float uPR; varying float vFacing;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vFacing = dot(normalize(normalMatrix*position), normalize(-mv.xyz)); gl_PointSize = 6.0 * uPR; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vFacing;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = (1.0 - smoothstep(0.38, 0.5, d)) * smoothstep(0.0, 0.2, vFacing);
          vec3 c = mix(vec3(1.0), vec3(0.62, 0.0, 0.22), smoothstep(0.2, 0.3, d));
          gl_FragColor = vec4(c * a, a);
        }`,
    });
    this.recent = new THREE.Points(geo, mat);
    this.recent.renderOrder = 4;
    this.recent.visible = visible;
    this.earth.add(this.recent);
  }

  focus(id: string | null) {
    this.focused = id;
    const focusAttr = this.points?.geometry.getAttribute('aFocus') as THREE.BufferAttribute | undefined;
    const ri = id && this.cells ? this.cells.regions.indexOf(id) : -1;
    if (focusAttr) { for (let i = 0; i < focusAttr.count; i++) focusAttr.setX(i, ri < 0 || this.cellRegion[i] === ri ? 1 : 0); focusAttr.needsUpdate = true; }
    const r = id ? this.regions.find((x) => x.id === id) : null;
    if (!r) { this.tDist = DIST_GLOBAL; this.tPitch = 0.3; this.stopReplay(); this.dropPatch(); return; }
    this.loadPatch(r.bbox);
    const [lat, lon] = r.center;
    let yaw = -(lon + 90) * D2R;
    while (yaw - this.yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw - this.yaw < -Math.PI) yaw += Math.PI * 2;
    this.tYaw = yaw;
    this.tPitch = lat * D2R;
    const ext = Math.max(r.bbox[2] - r.bbox[0], r.bbox[3] - r.bbox[1]);
    this.tDist = 1 + Math.min(1.7, Math.max(0.36, ext / 28));
  }

  /** Sharper NASA GIBS imagery for the focused country only (curved patch over the globe). */
  private dropPatch() {
    if (!this.patch) return;
    this.earth.remove(this.patch.group);
    this.patch.group.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); });
    this.patch.mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
    this.patch = undefined;
  }
  private loadPatch(bbox: [number, number, number, number]) {
    this.dropPatch();
    const w = Math.max(-180, bbox[0] - 1), s = Math.max(-90, bbox[1] - 1), e = Math.min(180, bbox[2] + 1), n = Math.min(90, bbox[3] + 1);
    const lonSpan = e - w, latSpan = n - s;
    const W = 2048, H = Math.max(256, Math.min(2048, Math.round((W * latSpan) / lonSpan)));
    const url = (layer: string, fmt: string) => `${GIBS_BASE}&LAYERS=${layer}&FORMAT=${fmt}&TRANSPARENT=TRUE&BBOX=${w},${s},${e},${n}&WIDTH=${W}&HEIGHT=${H}`;
    const geo = (r: number) => new THREE.SphereGeometry(r, 96, 96, (w + 180) * D2R, lonSpan * D2R, (90 - n) * D2R, latSpan * D2R);
    const group = new THREE.Group();
    const nightMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const coastMat = new THREE.MeshBasicMaterial({ color: 0x0b1a33, transparent: true, opacity: 0, depthWrite: false });
    const nightMesh = new THREE.Mesh(geo(1.0002), nightMat); nightMesh.renderOrder = 0.5;
    const coastMesh = new THREE.Mesh(geo(1.0013), coastMat); coastMesh.renderOrder = 1.5;
    group.add(nightMesh, coastMesh);
    this.earth.add(group);
    const patch = { group, mats: [nightMat, coastMat], loaded: [false, false] };
    this.patch = patch;
    const loader = new THREE.TextureLoader().setCrossOrigin('anonymous');
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    loader.load(url('BlueMarble_ShadedRelief_Bathymetry', 'image/jpeg'), (t) => {
      if (this.patch !== patch) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; nightMat.map = t; nightMat.needsUpdate = true; patch.loaded[0] = true;
    });
    loader.load(url('Coastlines_15m', 'image/png'), (t) => {
      if (this.patch !== patch) { t.dispose(); return; }
      t.anisotropy = aniso; coastMat.map = t; coastMat.needsUpdate = true; patch.loaded[1] = true;
    });
  }

  // ---------------------------------------------------------------- replay
  startReplay(days: number) {
    if (!this.pointMat) return;
    const from = this.replay && this.replay.day < days ? this.replay.day : 0.5;
    this.replay = { day: from, days, playing: true, lastSent: -1 };
  }
  pauseReplay() { if (this.replay) { this.replay.playing = false; this.emitReplay(true); } }
  seekReplay(day: number, days: number) {
    this.replay = { day, days, playing: false, lastSent: -1 };
    if (this.pointMat) this.pointMat.uniforms.uDay.value = day;
    this.emitReplay(true);
  }
  stopReplay() {
    this.replay = null;
    if (this.pointMat) this.pointMat.uniforms.uDay.value = 999;
    this.opts.onReplay?.(null);
  }
  private emitReplay(force = false) {
    const r = this.replay;
    if (!r || !this.opts.onReplay) return;
    const d = Math.floor(r.day);
    if (!force && d === r.lastSent) return;
    r.lastSent = d;
    const fi = this.focused && this.cells ? this.cells.regions.indexOf(this.focused) : -1;
    let burning = 0, fresh = 0;
    for (let i = 0; i < this.cellCount.length; i++) {
      if (this.cellCount[i] <= 0 || (fi >= 0 && this.cellRegion[i] !== fi)) continue;
      if (this.cellStart[i] <= d) burning++;
      if (this.cellStart[i] === d) fresh++;
    }
    this.opts.onReplay({ day: Math.min(d, r.days), days: r.days, playing: r.playing, burning, newToday: fresh });
  }

  // ---------------------------------------------------------------- input
  private bindInput() {
    const c = this.renderer.domElement;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('wheel', this.onWheel, { passive: false });
  }
  private onVis = () => { this.visible = document.visibilityState === 'visible'; };
  private onDown = (e: PointerEvent) => {
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.ptrs.size === 1) this.down = { x: e.clientX, y: e.clientY, moved: 0 };
    if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
  };
  private onMove = (e: PointerEvent) => {
    const p = this.ptrs.get(e.pointerId);
    if (!p) { this.renderer.domElement.style.cursor = this.hitRegion(e) ? 'pointer' : 'grab'; return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch0) this.tDist = THREE.MathUtils.clamp(this.tDist * (this.pinch0 / d), 1.25, 6);
      this.pinch0 = d;
      if (this.down) this.down.moved += 99;
      return;
    }
    if (this.down) this.down.moved += Math.abs(dx) + Math.abs(dy);
    const k = 0.0042 * (this.dist - 0.9);
    this.tYaw += dx * k;
    this.tPitch = THREE.MathUtils.clamp(this.tPitch + dy * k, -1.3, 1.3);
  };
  private onUp = (e: PointerEvent) => {
    this.ptrs.delete(e.pointerId);
    if (this.ptrs.size < 2) this.pinch0 = 0;
    if (this.down && this.down.moved < 6 && this.ptrs.size === 0) {
      const id = this.hitRegion(e);
      if (id) this.opts.onPick(id);
    }
    if (this.ptrs.size === 0) this.down = null;
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.tDist = THREE.MathUtils.clamp(this.tDist * (1 + e.deltaY * 0.001), 1.25, 6);
  };
  private ray = new THREE.Raycaster();
  private hitRegion(e: PointerEvent): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.intersectObject(this.globe, false)[0];
    if (!hit) return null;
    const { lat, lon } = vecToLL(this.earth.worldToLocal(hit.point.clone()));
    const inBox = this.regions
      .filter((r) => lon >= r.bbox[0] && lon <= r.bbox[2] && lat >= r.bbox[1] && lat <= r.bbox[3])
      .sort((a, b) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) - (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]));
    return inBox[0]?.id ?? null;
  }

  // ---------------------------------------------------------------- loop
  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.aspectK = Math.max(1, h / w);
    this.camera.updateProjectionMatrix();
    if (this.pointMat) this.pointMat.uniforms.uProj.value = (h * this.renderer.getPixelRatio()) / (2 * Math.tan((this.camera.fov * D2R) / 2));
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.visible) return;
    const rm = this.opts.reducedMotion;
    this.time += dt;

    if (!this.focused && !this.down && !rm) this.tYaw += dt * SPIN;
    const s = 1 - Math.exp(-dt * (rm ? 30 : 2.2));
    this.yaw += (this.tYaw - this.yaw) * s;
    this.pitch += (this.tPitch - this.pitch) * s;
    this.dist += (this.tDist - this.dist) * s;
    this.earth.rotation.set(this.pitch, this.yaw, 0);
    const k = 1 + (this.aspectK - 1) * Math.min(1, Math.max(0, (this.dist - 1) / (DIST_GLOBAL - 1)));
    this.camera.position.set(0, 0, 1 + (this.dist - 1) * k);
    this.camera.lookAt(0, 0, 0);
    this.earth.updateMatrixWorld(true);

    // zoom: fuel layer fades in, satellite beams fade back
    const zoomF = THREE.MathUtils.clamp((2.5 - this.dist) / 0.7, 0, 1);
    if (zoomF > 0 && !this.forestRequested) {
      this.forestRequested = true;
      new THREE.TextureLoader().load(this.opts.forestMaskUrl, (tex) => {
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        this.forestMat.map = tex; this.forestMat.needsUpdate = true;
      });
    }
    this.forestMat.opacity = this.forestMat.map ? zoomF * 0.8 : 0;
    if (this.patch) this.patch.mats.forEach((m, i) => { const target = this.patch!.loaded[i] ? (i === 0 ? 1 : 0.7) * zoomF : 0; m.opacity += (target - m.opacity) * Math.min(1, dt * 3); });
    const zoomed = zoomF > 0.5;
    if (zoomed !== this.zoomed) { this.zoomed = zoomed; this.opts.onZoom?.(zoomed); }

    // satellites (children of the Earth): orbit + slow precession so the ground track drifts
    const local = new THREE.Vector3();
    const centre = this.earth.localToWorld(new THREE.Vector3());
    for (const sat of this.sats) {
      const u = sat.phase + (rm ? 0 : this.time * ORBIT_REV_S * Math.PI * 2);
      if (!rm) sat.plane.rotation.y += dt * 0.02;
      sat.body.position.set(ORBIT_R * Math.cos(u), 0, -ORBIT_R * Math.sin(u));
      sat.plane.updateMatrixWorld(true);
      sat.body.lookAt(centre);
      sat.beamMat.uniforms.uTime.value = this.time;
      sat.beamMat.uniforms.uFade.value = 1 - zoomF * 0.6;
      sat.body.getWorldPosition(local);
      this.earth.worldToLocal(local);
      sat.sub.copy(local).normalize();
      sat.ring.position.copy(sat.sub).multiplyScalar(1.003);
      sat.ring.lookAt(this.earth.localToWorld(sat.sub.clone().multiplyScalar(2)));
      (sat.ring.material as THREE.MeshBasicMaterial).opacity = (0.3 + 0.2 * Math.sin(this.time * 3)) * (1 - zoomF * 0.5);
    }

    // scanning: fire cells under a swath light up
    if (this.points && this.pointMat) {
      const scan = this.points.geometry.getAttribute('aScan') as THREE.BufferAttribute;
      let changed = false;
      for (const sat of this.sats) sat.inSwath = 0;
      for (let i = 0; i < this.cellCount.length; i++) {
        if (this.cellCount[i] <= 0) continue;
        const x = this.cellVec[i * 3], y = this.cellVec[i * 3 + 1], z = this.cellVec[i * 3 + 2];
        for (const sat of this.sats) {
          if (x * sat.sub.x + y * sat.sub.y + z * sat.sub.z > COS_SWATH) {
            scan.setX(i, this.time); changed = true;
            sat.inSwath += this.cellCount[i];
          }
        }
      }
      if (changed) scan.needsUpdate = true;
      this.pointMat.uniforms.uTime.value = this.time;
      if (this.replay) {
        if (this.replay.playing) {
          this.replay.day += dt * 2.2;
          if (this.replay.day >= this.replay.days + 0.99) { this.replay.day = this.replay.days + 0.99; this.replay.playing = false; this.emitReplay(true); }
        }
        this.pointMat.uniforms.uDay.value = this.replay.day;
        this.emitReplay();
      }
    }
    if (this.events) (this.events.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;

    this.renderer.render(this.scene, this.camera);
    this.placeLabels();

    this.infoTick += dt;
    if (this.opts.onSatInfo && this.infoTick > 0.3) {
      this.infoTick = 0;
      this.opts.onSatInfo(this.sats.map((s) => ({ name: s.name, ...vecToLL(s.sub), inSwath: s.inSwath })));
    }
  };

  private placeLabels() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const camDir = this.camera.position.clone().normalize();
    const v = new THREE.Vector3();
    for (const { el, anchor } of this.labels.values()) {
      v.copy(anchor).applyMatrix4(this.earth.matrixWorld);
      const facing = v.clone().normalize().dot(camDir);
      v.project(this.camera);
      const show = facing > 0.25;
      el.style.opacity = show ? String(Math.min(1, (facing - 0.25) * 4)) : '0';
      el.style.pointerEvents = show ? 'auto' : 'none';
      el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h - 6}px)`;
    }
    for (const sat of this.sats) {
      const el = this.satLabels.get(sat.name);
      if (!el) continue;
      sat.body.getWorldPosition(v);
      const behind = v.z < 0 && Math.hypot(v.x, v.y) < 1.02;
      v.project(this.camera);
      el.style.opacity = behind || this.zoomed ? '0' : '1';
      el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h - 12}px)`;
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((mat) => { (mat as THREE.MeshBasicMaterial).map?.dispose(); mat.dispose(); });
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
