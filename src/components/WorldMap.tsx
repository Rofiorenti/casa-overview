import * as React from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import { COUNTRY_CENTROIDS } from '@/lib/types';
import { eur, num } from '@/lib/utils';
import { Plus, Minus, Maximize2 } from 'lucide-react';

export interface CountryDataPoint {
  country: string;
  lordo: number;
  count: number;
  guests: number;
  pernotti: number;
}

const WIDTH = 900;
const HEIGHT = 460;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

interface Tooltip {
  x: number;
  y: number;
  country: string;
  lordo: number;
  count: number;
}

interface Transform {
  x: number;
  y: number;
  k: number;  // scale factor
}

const IDENTITY: Transform = { x: 0, y: 0, k: 1 };

export function WorldMap({ countries }: { countries: CountryDataPoint[] }) {
  const [worldGeo, setWorldGeo] = React.useState<FeatureCollection<Geometry> | null>(null);
  const [tooltip, setTooltip] = React.useState<Tooltip | null>(null);
  const [transform, setTransform] = React.useState<Transform>(IDENTITY);

  // Pan state (drag)
  const panStart = React.useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  // Pinch state
  const pinchStart = React.useRef<{ dist: number; centerX: number; centerY: number; transform: Transform } | null>(null);

  const svgRef = React.useRef<SVGSVGElement | null>(null);

  // Carica topojson
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
        const topology = await resp.json();
        if (cancelled) return;
        const geo = feature(topology, topology.objects.countries) as unknown as FeatureCollection<Geometry>;
        setWorldGeo(geo);
      } catch (e) {
        console.error('[worldmap] loading failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const projection = React.useMemo(() => {
    return geoNaturalEarth1()
      .scale(170)
      .translate([WIDTH / 2, HEIGHT / 2]);
  }, []);

  const pathGen = React.useMemo(() => geoPath(projection as any), [projection]);

  const maxLordo = React.useMemo(
    () => Math.max(...countries.map((c) => c.lordo), 1),
    [countries]
  );

  // ---- Zoom helpers ----

  const clampTransform = (t: Transform): Transform => {
    const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, t.k));
    // Limita il pan: la mappa non può uscire completamente di vista
    const maxX = (k - 1) * WIDTH / 2;
    const maxY = (k - 1) * HEIGHT / 2;
    return {
      k,
      x: Math.max(-maxX, Math.min(maxX, t.x)),
      y: Math.max(-maxY, Math.min(maxY, t.y)),
    };
  };

  const zoomAt = (scaleBy: number, clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Punto in coordinate SVG
    const px = ((clientX - rect.left) / rect.width) * WIDTH;
    const py = ((clientY - rect.top) / rect.height) * HEIGHT;
    setTransform((prev) => {
      const newK = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.k * scaleBy));
      const actualScale = newK / prev.k;
      // Il punto (px, py) deve rimanere fisso → aggiusta x/y
      const newX = px - (px - prev.x) * actualScale;
      const newY = py - (py - prev.y) * actualScale;
      return clampTransform({ x: newX, y: newY, k: newK });
    });
  };

  // ---- Event handlers ----

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    // Normalizza il deltaY per diversi dispositivi (trackpad Mac gestisce pinch con Ctrl)
    const scaleBy = Math.pow(1.002, -e.deltaY);
    zoomAt(scaleBy, e.clientX, e.clientY);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!panStart.current) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const dx = (e.clientX - panStart.current.x) * scaleX;
    const dy = (e.clientY - panStart.current.y) * scaleY;
    setTransform(clampTransform({
      x: panStart.current.tx + dx,
      y: panStart.current.ty + dy,
      k: transform.k,
    }));
  };

  const endPan = () => { panStart.current = null; };

  // Touch events per pinch + pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchStart.current = {
        dist,
        centerX: (t1.clientX + t2.clientX) / 2,
        centerY: (t1.clientY + t2.clientY) / 2,
        transform: { ...transform },
      };
      panStart.current = null;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      panStart.current = { x: t.clientX, y: t.clientY, tx: transform.x, ty: transform.y };
      pinchStart.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchStart.current) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scaleBy = dist / pinchStart.current.dist;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = ((pinchStart.current.centerX - rect.left) / rect.width) * WIDTH;
      const py = ((pinchStart.current.centerY - rect.top) / rect.height) * HEIGHT;
      const start = pinchStart.current.transform;
      const newK = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, start.k * scaleBy));
      const actualScale = newK / start.k;
      const newX = px - (px - start.x) * actualScale;
      const newY = py - (py - start.y) * actualScale;
      setTransform(clampTransform({ x: newX, y: newY, k: newK }));
    } else if (e.touches.length === 1 && panStart.current) {
      const t = e.touches[0];
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scaleX = WIDTH / rect.width;
      const scaleY = HEIGHT / rect.height;
      const dx = (t.clientX - panStart.current.x) * scaleX;
      const dy = (t.clientY - panStart.current.y) * scaleY;
      setTransform(clampTransform({
        x: panStart.current.tx + dx,
        y: panStart.current.ty + dy,
        k: transform.k,
      }));
    }
  };

  const handleTouchEnd = () => {
    panStart.current = null;
    pinchStart.current = null;
  };

  // ---- Button actions ----

  const zoomIn = () => {
    setTransform((prev) => {
      const newK = Math.min(MAX_ZOOM, prev.k * 1.5);
      const actualScale = newK / prev.k;
      // Zoom verso il centro attuale della vista
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;
      return clampTransform({
        x: cx - (cx - prev.x) * actualScale,
        y: cy - (cy - prev.y) * actualScale,
        k: newK,
      });
    });
  };

  const zoomOut = () => {
    setTransform((prev) => {
      const newK = Math.max(MIN_ZOOM, prev.k / 1.5);
      const actualScale = newK / prev.k;
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;
      return clampTransform({
        x: cx - (cx - prev.x) * actualScale,
        y: cy - (cy - prev.y) * actualScale,
        k: newK,
      });
    });
  };

  const resetView = () => setTransform(IDENTITY);

  const transformStr = `translate(${transform.x} ${transform.y}) scale(${transform.k})`;

  return (
    <div className="relative bg-muted/30 rounded-lg overflow-hidden border border-border/60">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto touch-none select-none"
        role="img"
        aria-label="Mappa paesi"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: panStart.current ? 'grabbing' : 'grab' }}
      >
        <defs>
          <filter id="circle-shadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
            <feOffset dx="0" dy="1" />
            <feFlood floodColor="hsl(var(--accent))" floodOpacity="0.4" />
            <feComposite in2="SourceAlpha" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={transformStr}>
          {/* Country shapes */}
          {worldGeo && (
            <g>
              {worldGeo.features.map((f, i) => {
                const d = pathGen(f as any);
                if (!d) return null;
                return (
                  <path
                    key={i}
                    d={d}
                    className="fill-muted stroke-border/80"
                    strokeWidth={0.5 / transform.k}
                    style={{ fillOpacity: 0.5 }}
                  />
                );
              })}
            </g>
          )}

          {!worldGeo && (
            <text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" className="fill-muted-foreground text-sm">
              Caricamento mappa…
            </text>
          )}

          {/* Country circles */}
          {worldGeo && countries.map((c) => {
            const coords = COUNTRY_CENTROIDS[c.country];
            if (!coords) return null;
            const projected = projection([coords.lng, coords.lat]);
            if (!projected) return null;
            const [x, y] = projected;
            const radius = (4 + 22 * Math.sqrt(c.lordo / maxLordo)) / Math.sqrt(transform.k);
            return (
              <g
                key={c.country}
                className="cursor-pointer"
                onMouseEnter={() => setTooltip({ x, y, country: c.country, lordo: c.lordo, count: c.count })}
                onMouseLeave={() => setTooltip(null)}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill="hsl(var(--accent))"
                  fillOpacity={0.35}
                  stroke="hsl(var(--accent))"
                  strokeWidth={1.5 / transform.k}
                  filter="url(#circle-shadow)"
                />
                <circle cx={x} cy={y} r={2.5 / transform.k} fill="hsl(var(--accent))" />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 bg-background/90 backdrop-blur-sm rounded-md border border-border/60 shadow-sm">
        <button
          onClick={zoomIn}
          disabled={transform.k >= MAX_ZOOM}
          className="p-1.5 hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed border-b border-border/40"
          title="Zoom in"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={zoomOut}
          disabled={transform.k <= MIN_ZOOM}
          className="p-1.5 hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed border-b border-border/40"
          title="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          disabled={transform.k === 1 && transform.x === 0 && transform.y === 0}
          className="p-1.5 hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Reset"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {tooltip && (
        <div
          className="absolute bg-background border border-border rounded-md shadow-lg px-3 py-2 pointer-events-none text-xs z-10"
          style={{
            // Tooltip posizionato sul punto trasformato
            left: `calc(${((tooltip.x * transform.k + transform.x) / WIDTH) * 100}% + 14px)`,
            top: `calc(${((tooltip.y * transform.k + transform.y) / HEIGHT) * 100}% - 10px)`,
            transform: 'translate(0, -50%)',
          }}
        >
          <div className="font-medium text-sm">{tooltip.country}</div>
          <div className="num text-accent">{eur(tooltip.lordo)}</div>
          <div className="text-muted-foreground">{num(tooltip.count)} prenotazioni</div>
        </div>
      )}

      {/* Help hint in basso */}
      <div className="absolute bottom-2 left-3 text-[10px] text-muted-foreground/70 pointer-events-none bg-background/60 backdrop-blur-sm px-2 py-0.5 rounded">
        Trascina per muovere · scroll/pinch per zoom
      </div>
    </div>
  );
}
