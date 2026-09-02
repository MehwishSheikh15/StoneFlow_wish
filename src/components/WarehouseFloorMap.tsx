import React, { useState } from 'react';
import { Material } from '../types';
import { Layers, MapPin, Sparkles, Package, Info, Plus } from 'lucide-react';

interface WarehouseFloorMapProps {
  materials: Material[];
  onSelectMaterial: (m: Material) => void;
  onSelectEmptySlot?: (coord: string) => void;
}

const getStoneStyle = (color?: string) => {
  const c = (color || '').toLowerCase();
  if (c.includes('calacatta')) {
    return {
      background: 'linear-gradient(135deg, #fafaf8 0%, #f3f1ec 45%, #d5c399 47%, #bda474 48%, #f3f1ec 50%, #e8e6e0 100%)',
      veins: 'rgba(213, 195, 153, 0.45)',
      borderColor: '#e2dfd7',
      text: 'text-zinc-800'
    };
  }
  if (c.includes('nero') || c.includes('black') || c.includes('marquina')) {
    return {
      background: 'linear-gradient(125deg, #111215 0%, #1a1c23 48%, #ffffff 49%, #ffffff 51%, #1a1c23 52%, #090a0c 100%)',
      veins: 'rgba(255, 255, 255, 0.75)',
      borderColor: '#2e313a',
      text: 'text-white'
    };
  }
  if (c.includes('verde') || c.includes('green') || c.includes('alpi')) {
    return {
      background: 'linear-gradient(140deg, #0e271c 0%, #173f2e 40%, #b2dbcc 41%, #173f2e 43%, #081711 100%)',
      veins: 'rgba(178, 219, 204, 0.6)',
      borderColor: '#1f4c39',
      text: 'text-emerald-100'
    };
  }
  if (c.includes('silestone') || c.includes('ethereal') || c.includes('white')) {
    return {
      background: 'linear-gradient(130deg, #f6f8fb 0%, #ebedf3 65%, #9cb2c9 67%, #ebedf3 69%, #f6f8fb 100%)',
      veins: 'rgba(156, 178, 201, 0.45)',
      borderColor: '#d2d8e4',
      text: 'text-zinc-800'
    };
  }
  if (c.includes('emperador') || c.includes('brown') || c.includes('dark')) {
    return {
      background: 'linear-gradient(135deg, #3c261b 0%, #4e3527 38%, #e7d3bf 40%, #4e3527 42%, #291810 100%)',
      veins: 'rgba(231, 211, 191, 0.55)',
      borderColor: '#5c4132',
      text: 'text-amber-100'
    };
  }
  if (c.includes('jasper') || c.includes('ocean')) {
    return {
      background: 'radial-gradient(circle at 40% 40%, #5d9d9b 0%, #275654 35%, #99cbc9 37%, #1a3c3b 65%, #0f2423 100%)',
      veins: 'rgba(153, 203, 201, 0.55)',
      borderColor: '#3a6c6a',
      text: 'text-teal-100'
    };
  }
  return {
    background: 'linear-gradient(145deg, #e3e4e6 0%, #cbd0d4 50%, #9aa0a6 100%)',
    veins: 'rgba(255, 255, 255, 0.35)',
    borderColor: '#b2b7bd',
    text: 'text-zinc-800'
  };
};

export const WarehouseFloorMap: React.FC<WarehouseFloorMapProps> = ({
  materials,
  onSelectMaterial,
  onSelectEmptySlot,
}) => {
  const rows = ['A', 'B', 'C', 'D', 'E'];
  const cols = [1, 2, 3, 4, 5];

  // Map coordinate strings like "A1" to their respective Material
  const getMaterialAt = (coord: string): Material | undefined => {
    return materials.find(m => m.coordinates?.toUpperCase() === coord.toUpperCase());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-emerald-500 border-emerald-400 text-emerald-100';
      case 'reserved': return 'bg-indigo-500 border-indigo-400 text-indigo-100';
      case 'in-use': return 'bg-amber-500 border-amber-400 text-amber-100';
      case 'low': return 'bg-rose-500 border-rose-400 text-rose-100';
      case 'missing': return 'bg-zinc-600 border-zinc-500 text-zinc-300';
      default: return 'bg-zinc-400 border-zinc-300 text-zinc-800';
    }
  };

  const occupiedCount = materials.filter(m => m.coordinates).length;
  const totalSlots = rows.length * cols.length;
  const utilizationRate = Math.round((occupiedCount / totalSlots) * 100);

  return (
    <div id="warehouse-map-container" className="bg-paper border border-line rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-soft pb-4">
        <div>
          <h2 className="text-base font-disp font-extrabold text-ink flex items-center gap-2">
            <Layers className="w-5 h-5 text-sap" />
            Interactive Warehouse Floor Map
          </h2>
          <p className="text-xs text-mut mt-0.5">
            Realtime slab positioning and rack grid layout. Click occupied slot to edit, empty slot to register.
          </p>
        </div>
        
        {/* Utilization Gauge */}
        <div className="flex items-center gap-3.5 bg-soft px-4 py-2 rounded-xl border border-line">
          <div className="text-right">
            <span className="block text-[10px] font-bold text-mut uppercase">Slab Space Utilization</span>
            <span className="text-lg font-disp font-black text-ink">{occupiedCount} / {totalSlots} slots <span className="text-xs font-semibold text-sap">({utilizationRate}%)</span></span>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-line relative flex items-center justify-center overflow-hidden">
            <div 
              className="absolute bottom-0 left-0 right-0 bg-sap/15 transition-all duration-500" 
              style={{ height: `${utilizationRate}%` }}
            />
            <span className="relative z-10 text-[10px] font-black text-ink font-mono">{utilizationRate}%</span>
          </div>
        </div>
      </div>

      {/* Grid Layout & Labels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Visual Map Grid */}
        <div className="lg:col-span-8 overflow-x-auto pb-2 select-none">
          <div className="min-w-[550px] p-2 bg-soft/30 border border-line rounded-2xl">
            {/* Column Headers */}
            <div className="grid grid-cols-6 gap-2 text-center mb-1">
              <div className="flex items-center justify-center font-bold text-mut text-xs font-mono uppercase">Racks</div>
              {cols.map(c => (
                <div key={c} className="font-disp font-extrabold text-xs text-mut py-1 bg-soft/50 rounded border border-line/30">
                  Lane {c}
                </div>
              ))}
            </div>

            {/* Grid Rows */}
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r} className="grid grid-cols-6 gap-2 items-stretch">
                  {/* Row Label */}
                  <div className="flex items-center justify-center font-disp font-black text-ink bg-soft/50 rounded-lg border border-line/50 text-sm font-mono shadow-sm">
                    Row {r}
                  </div>

                  {/* Grid Slots */}
                  {cols.map(c => {
                    const coord = `${r}${c}`;
                    const slab = getMaterialAt(coord);
                    const stoneStyle = slab ? getStoneStyle(slab.color) : null;

                    return (
                      <div
                        key={c}
                        onClick={() => {
                          if (slab) {
                            onSelectMaterial(slab);
                          } else if (onSelectEmptySlot) {
                            onSelectEmptySlot(coord);
                          }
                        }}
                        className={`group relative h-28 rounded-xl border flex flex-col justify-between p-2.5 transition-all duration-300 cursor-pointer shadow-sm ${
                          slab 
                            ? 'hover:scale-[1.03] hover:shadow-md' 
                            : 'bg-paper/30 border-dashed border-line/80 hover:border-sap hover:bg-sap/5'
                        }`}
                        style={slab && stoneStyle ? { 
                          background: stoneStyle.background, 
                          borderColor: stoneStyle.borderColor 
                        } : {}}
                      >
                        {/* Organic Veins Overlay for occupied slab slots */}
                        {slab && stoneStyle && (
                          <div 
                            className="absolute inset-0 opacity-25 pointer-events-none rounded-xl"
                            style={{
                              backgroundImage: `radial-gradient(circle at 20% 30%, transparent 58%, ${stoneStyle.veins} 60%, transparent 63%), 
                                                radial-gradient(circle at 80% 70%, transparent 38%, ${stoneStyle.veins} 40%, transparent 42%)`
                            }}
                          />
                        )}

                        {/* Top Indicator */}
                        <div className="relative z-10 flex justify-between items-start w-full">
                          <span className={`text-[10px] font-mono font-black ${slab && stoneStyle ? stoneStyle.text : 'text-mut'}`}>
                            {coord}
                          </span>
                          
                          {slab ? (
                            <span className={`w-2.5 h-2.5 rounded-full border border-white/20 shadow-sm ${getStatusColor(slab.status).split(' ')[0]}`} />
                          ) : (
                            <span className="text-[9px] font-bold text-mut/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                              <Plus className="w-2.5 h-2.5" /> FREE
                            </span>
                          )}
                        </div>

                        {/* Slab color name / label */}
                        {slab ? (
                          <div className="relative z-10 text-left mt-auto">
                            <span className={`block font-disp font-black text-xs leading-tight truncate ${stoneStyle?.text}`}>
                              {slab.color}
                            </span>
                            <span className={`block text-[9px] font-bold opacity-75 truncate ${stoneStyle?.text}`}>
                              ID: {slab.slab_id}
                            </span>
                          </div>
                        ) : (
                          <div className="text-center my-auto">
                            <span className="text-[10px] font-bold text-mut/30 group-hover:text-sap transition-colors block">
                              EMPTY SLOT
                            </span>
                          </div>
                        )}

                        {/* Hover Tooltip / Detail Floating Card */}
                        {slab && (
                          <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-paper border border-line rounded-2xl p-4 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-250 translate-y-2 group-hover:-translate-y-0 text-xs text-ink space-y-2">
                            <div className="flex justify-between items-center border-b border-soft pb-1.5">
                              <span className="font-mono font-bold text-mut">{coord} • {slab.slab_id}</span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                slab.available ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'
                              }`}>
                                {slab.status}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-bold text-mut uppercase">Material Name</span>
                              <span className="font-bold text-ink text-sm">{slab.color}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <span className="block font-bold text-mut uppercase">Type</span>
                                <span className="font-semibold text-ink truncate block">{slab.type}</span>
                              </div>
                              <div>
                                <span className="block font-bold text-mut uppercase">Qty</span>
                                <span className="font-semibold text-ink truncate block">{slab.quantity}</span>
                              </div>
                            </div>
                            {slab.dimensions && (
                              <div>
                                <span className="block text-[10px] font-bold text-mut uppercase">Dimensions</span>
                                <span className="font-semibold text-ink">{slab.dimensions}</span>
                              </div>
                            )}
                            {slab.notes && (
                              <div className="border-t border-soft pt-1.5 text-[10px] text-mut italic">
                                "{slab.notes}"
                              </div>
                            )}
                            <div className="text-[9px] font-bold text-sap flex items-center gap-1 justify-center pt-1 border-t border-soft">
                              <Sparkles className="w-3 h-3" /> Click slot to Quick Edit
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend & Operations Guide */}
        <div className="lg:col-span-4 bg-soft/50 border border-line rounded-2xl p-5 space-y-4 text-xs">
          <div>
            <h3 className="font-bold text-ink text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-4 h-4 text-sap" />
              Slab Rack Legend
            </h3>
            <p className="text-mut text-[11px] mt-0.5">Warehouse status color codes and slab details.</p>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2 bg-paper rounded-xl border border-line">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="font-bold text-ink">Available Slabs</span>
              </div>
              <span className="font-mono text-[10px] font-bold text-mut">
                {materials.filter(m => m.status === 'available').length} slabs
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-paper rounded-xl border border-line">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="font-bold text-ink">Reserved for Jobs</span>
              </div>
              <span className="font-mono text-[10px] font-bold text-mut">
                {materials.filter(m => m.status === 'reserved').length} slabs
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-paper rounded-xl border border-line">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="font-bold text-ink">In Active Fabrication</span>
              </div>
              <span className="font-mono text-[10px] font-bold text-mut">
                {materials.filter(m => m.status === 'in-use').length} slabs
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-paper rounded-xl border border-line">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="font-bold text-ink">Low Stock Warning</span>
              </div>
              <span className="font-mono text-[10px] font-bold text-mut">
                {materials.filter(m => m.status === 'low').length} slabs
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-paper rounded-xl border border-line">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-zinc-600" />
                <span className="font-bold text-ink">Missing / Untracked</span>
              </div>
              <span className="font-mono text-[10px] font-bold text-mut">
                {materials.filter(m => m.status === 'missing').length} slabs
              </span>
            </div>
          </div>

          <div className="bg-sap/5 border border-sap/10 rounded-xl p-3.5 space-y-1.5">
            <span className="font-bold text-sap uppercase text-[10px] tracking-wide block">PRO-TIP FOR OPERATORS</span>
            <p className="text-zinc-600 leading-relaxed text-[11px]">
              You can instantly organize slab storage locations by selecting any slab in the list below, clicking "Quick Edit", and changing the rack label (e.g. <b>Rack A</b>) and coordinates (e.g. <b>B3</b>). Slabs will instantly snap to their positions on the live warehouse map.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
