import { X } from 'lucide-react';
import type { Photo } from '../photo';

// The strip of thumbnails (SPEC.md section 5, Several photos)
export default function Strip({ photos, current, onSelect, onClose, className = '' }: {
  photos: readonly Photo[];
  current: number;
  onSelect: (index: number) => void;
  onClose: (id: number) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 overflow-x-auto px-3 py-2 ${className}`}>
      {photos.map((p, i) => (
        <div key={p.id} className="relative shrink-0">
          <button
            type="button"
            onClick={() => onSelect(i)}
            title={p.name}
            className={`block h-16 w-16 overflow-hidden rounded-md border-2 ${
              i === current ? 'border-sky-500' : 'border-transparent'}`}
          >
            <img src={p.thumbUrl} alt={p.name} className="h-full w-full object-cover" draggable={false} />
          </button>
          <button
            type="button"
            onClick={() => onClose(p.id)}
            aria-label={`Close ${p.name}`}
            className="absolute -right-1 -top-1 rounded-full bg-slate-700 p-0.5 text-white shadow"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
