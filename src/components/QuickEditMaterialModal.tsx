import React, { useState, useEffect } from 'react';
import { X, Check, Package, Scissors, MapPin, Layers, Info, Trash2 } from 'lucide-react';

interface QuickEditItem {
  id: string;
  type: 'slab' | 'offcut';
  color: string;
  quantity: string;
  status: string;
  location?: string;
  brand?: string;
  dimensions?: string;
  slab_id?: string;
  rack?: string;
  coordinates?: string;
}

interface QuickEditMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: QuickEditItem | null;
  onSave: (
    id: string,
    type: 'slab' | 'offcut',
    updatedFields: {
      status: any;
      quantity: string;
      location?: string;
      dimensions?: string;
      color?: string;
      rack?: string;
      coordinates?: string;
    }
  ) => void;
  onDelete?: (id: string, type: 'slab' | 'offcut') => void;
}

export const QuickEditMaterialModal: React.FC<QuickEditMaterialModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave,
  onDelete,
}) => {
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [rack, setRack] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Sync state with selected item when modal opens
  useEffect(() => {
    if (item) {
      setColor(item.color || '');
      setQuantity(item.quantity || '');
      setStatus(item.status || '');
      setLocation(item.location || '');
      setDimensions(item.dimensions || '');
      setRack(item.rack || '');
      setCoordinates(item.coordinates || '');
      setIsConfirmingDelete(false);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const isSlab = item.type === 'slab';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(item.id, item.type, {
      color,
      quantity,
      status,
      location: isSlab ? undefined : location,
      dimensions: dimensions || undefined,
      rack: isSlab ? rack : undefined,
      coordinates: isSlab ? coordinates : undefined,
    });
    onClose();
  };

  // Helper to parse numeric quantity
  const handleQuantityAdjust = (amount: number) => {
    // Try to extract number from quantity string e.g. "2 slabs" or "1 piece"
    const match = quantity.match(/^(\d+)(.*)$/);
    if (match) {
      const currentNum = parseInt(match[1], 10);
      const suffix = match[2];
      const newNum = Math.max(0, currentNum + amount);
      setQuantity(`${newNum}${suffix}`);
    } else {
      // Fallback
      const parsed = parseInt(quantity, 10);
      if (!isNaN(parsed)) {
        setQuantity(String(Math.max(0, parsed + amount)));
      } else {
        setQuantity(amount > 0 ? '1' : '0');
      }
    }
  };

  const slabStatusOptions = [
    { value: 'available', label: 'Available', color: 'bg-emsoft text-em border-em/20' },
    { value: 'reserved', label: 'Reserved', color: 'bg-sapsoft text-sap border-sap/20' },
    { value: 'in-use', label: 'In-Use', color: 'bg-amsoft text-am border-am/20' },
    { value: 'low', label: 'Low Stock', color: 'bg-rubysoft text-ruby border-ruby/20' },
    { value: 'missing', label: 'Missing', color: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
  ];

  const offcutStatusOptions = [
    { value: 'available', label: 'Available', color: 'bg-emsoft text-em border-em/20' },
    { value: 'reserved', label: 'Reserved', color: 'bg-sapsoft text-sap border-sap/20' },
    { value: 'used', label: 'Used / Archived', color: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
  ];

  const currentOptions = isSlab ? slabStatusOptions : offcutStatusOptions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-paper border border-line rounded-3xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-line bg-soft flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sap flex items-center justify-center text-white">
              {isSlab ? <Package className="w-4.5 h-4.5" /> : <Scissors className="w-4.5 h-4.5" />}
            </div>
            <div>
              <h3 className="font-disp font-extrabold text-ink text-base">
                Quick Edit {isSlab ? 'Slab' : 'Remnant'}
              </h3>
              <p className="text-[10px] text-mut mt-0.5">
                ID: {item.id} • Registered to Job Ref: {item.slab_id || 'Direct'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-line rounded-lg text-mut hover:text-ink cursor-pointer transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Main Info */}
          <div className="p-4 bg-soft/50 border border-line rounded-2xl space-y-3">
            <div className="space-y-1">
              <label className="font-bold text-ink uppercase text-[10px] tracking-wide block">Material Name (Color)</label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-3 py-2 bg-paper border border-line rounded-xl text-ink font-semibold focus:outline-none focus:border-sap text-xs transition-all"
                placeholder="e.g. Calacatta Gold"
                required
              />
            </div>

            {isSlab && item.brand && (
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-mut">Slab Brand:</span>
                <span className="font-bold text-ink">{item.brand}</span>
              </div>
            )}
          </div>

          {/* Quantity Controls */}
          <div className="space-y-1.5">
            <label className="font-bold text-ink uppercase text-[10px] tracking-wide block">Quantity Adjustments</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuantityAdjust(-1)}
                className="w-10 h-10 rounded-xl bg-soft border border-line text-ink font-bold hover:bg-line flex items-center justify-center transition-all cursor-pointer text-sm"
              >
                -
              </button>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="flex-1 h-10 text-center bg-soft border border-line rounded-xl text-ink font-bold text-xs focus:outline-none focus:border-sap"
                placeholder="e.g. 1 slab"
                required
              />
              <button
                type="button"
                onClick={() => handleQuantityAdjust(1)}
                className="w-10 h-10 rounded-xl bg-soft border border-line text-ink font-bold hover:bg-line flex items-center justify-center transition-all cursor-pointer text-sm"
              >
                +
              </button>
            </div>
            <p className="text-[10px] text-mut flex items-center gap-1 pl-1">
              <Info className="w-3 h-3 text-sap" />
              Use button increments or type any custom quantity / unit format.
            </p>
          </div>

          {/* Status selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-ink uppercase text-[10px] tracking-wide block">Inventory Status</label>
            <div className="grid grid-cols-2 gap-2">
              {currentOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`px-3 py-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    status === opt.value
                      ? `${opt.color} ring-2 ring-sap/30 border-sap shadow-sm`
                      : 'bg-paper border-line text-mut hover:border-mut/60 hover:text-ink'
                  }`}
                >
                  <span>{opt.label}</span>
                  {status === opt.value && <Check className="w-4 h-4 text-sap" />}
                </button>
              ))}
            </div>
          </div>

          {/* Extra Fields (Dimensions, Storage location for remnant, Rack & Coordinates for slabs) */}
          <div className="grid grid-cols-1 gap-3.5 pt-1">
            <div className="space-y-1">
              <label className="font-bold text-ink uppercase text-[10px] tracking-wide block">Physical Dimensions</label>
              <div className="relative">
                <input
                  type="text"
                  value={dimensions}
                  onChange={(e) => setDimensions(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-soft border border-line rounded-xl text-ink focus:outline-none focus:border-sap text-xs transition-all"
                  placeholder="e.g. 3200 × 1600 mm"
                />
                <Layers className="w-3.5 h-3.5 text-mut absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {isSlab ? (
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="font-bold text-ink uppercase text-[10px] tracking-wide block">Rack Label</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={rack}
                      onChange={(e) => setRack(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-soft border border-line rounded-xl text-ink focus:outline-none focus:border-sap text-xs transition-all"
                      placeholder="e.g. Rack A"
                    />
                    <MapPin className="w-3.5 h-3.5 text-mut absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-ink uppercase text-[10px] tracking-wide block">Grid position (A1-E5)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={coordinates}
                      onChange={(e) => setCoordinates(e.target.value.toUpperCase())}
                      className="w-full pl-9 pr-3 py-2 bg-soft border border-line rounded-xl text-ink focus:outline-none focus:border-sap text-xs transition-all font-mono"
                      placeholder="e.g. A3"
                      maxLength={2}
                    />
                    <Layers className="w-3.5 h-3.5 text-mut absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="font-bold text-ink uppercase text-[10px] tracking-wide block">Remnant Location</label>
                <div className="relative">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-soft border border-line rounded-xl text-ink focus:outline-none focus:border-sap text-xs transition-all"
                    placeholder="e.g. Rack B-12"
                  />
                  <MapPin className="w-3.5 h-3.5 text-mut absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-3 border-t border-line">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-sap hover:opacity-90 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              Save Specifications
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (isConfirmingDelete) {
                    onDelete(item.id, item.type);
                    onClose();
                  } else {
                    setIsConfirmingDelete(true);
                  }
                }}
                className={`px-3.5 py-2.5 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm ${
                  isConfirmingDelete ? 'bg-red-700 text-white animate-pulse ring-2 ring-red-400' : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title="Delete item from inventory"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isConfirmingDelete ? 'Confirm Delete?' : 'Delete'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-soft border border-line text-ink font-bold rounded-xl text-xs hover:bg-line cursor-pointer transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
