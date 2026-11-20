import React, { useState } from 'react';
import { useKitchenStore } from '../../store/useKitchenStore';
import {
  X,
  Sparkles,
  Check,
  CheckSquare2,
  Square,
  Flame,
  Droplets,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';

interface UpperCabinetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpperCabinetModal: React.FC<UpperCabinetModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { generateUpperWithConfig, setDesignPhase } = useKitchenStore();

  // 1. Khoang hút mùi
  const [includeHood, setIncludeHood] = useState(true);

  // 2. Khoang giá bát
  const [dishFixed, setDishFixed] = useState(true); // UB02
  const [dishManual, setDishManual] = useState(false); // UB01
  const [dishElectric, setDishElectric] = useState(false); // UB03

  // 3. Khoang gia vị tủ trên
  const [spiceManual, setSpiceManual] = useState(false); // UG01
  const [spiceElectric, setSpiceElectric] = useState(false); // UG02

  // 4. Khoang để đồ tủ trên (luôn bật để lấp đầy khoảng trống)
  const [includeStorage, setIncludeStorage] = useState(true); // UT01

  if (!isOpen) return null;

  const handleGenerateUpper = () => {
    const codes: string[] = [];

    if (includeHood) codes.push('UH01');
    if (dishFixed) codes.push('UB02');
    if (dishManual) codes.push('UB01');
    if (dishElectric) codes.push('UB03');
    if (spiceManual) codes.push('UG01');
    if (spiceElectric) codes.push('UG02');
    if (includeStorage) codes.push('UT01');

    generateUpperWithConfig(codes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Chọn Khoang Công Năng Tủ Trên</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  BƯỚC 2 / 2
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Tủ trên sẽ tự động bố trí vào các khoảng trống, né tủ cao và thẳng tim thiết bị
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-slate-200 text-xs">
          {/* 1. KHOANG HÚT MÙI */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div
              onClick={() => setIncludeHood(!includeHood)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                {includeHood ? (
                  <CheckSquare2 className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-slate-100 flex items-center gap-2">
                    <span>Khoang máy hút mùi (UH01)</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                      710, 810, 910mm
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Hút mùi âm tủ / kính cong gắn tường
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                Thẳng tim Bếp nấu
              </span>
            </div>
          </div>

          {/* 2. KHOANG GIÁ BÁT ĐĨA */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sky-400 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5" />
                <span>Khoang Giá Bát Đĩa Tủ Trên</span>
              </h4>
              <span className="text-[10px] text-slate-500">
                Ưu tiên thẳng tim Chậu rửa
              </span>
            </div>

            <div className="space-y-2 pl-1">
              {/* UB02: Cố định */}
              <div
                onClick={() => setDishFixed(!dishFixed)}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                {dishFixed ? (
                  <CheckSquare2 className="w-4 h-4 text-sky-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600 shrink-0" />
                )}
                <div className="flex-1">
                  <span className="font-bold text-slate-200">
                    Giá bát cố định inox 304 (UB02)
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Khay hứng nước inox, 2 tầng nan úp bát đĩa (600 - 900mm)
                  </span>
                </div>
              </div>

              {/* UB01: Nâng hạ cơ */}
              <div
                onClick={() => setDishManual(!dishManual)}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                {dishManual ? (
                  <CheckSquare2 className="w-4 h-4 text-sky-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600 shrink-0" />
                )}
                <div className="flex-1">
                  <span className="font-bold text-slate-200">
                    Giá bát nâng hạ cơ thủy lực (UB01)
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Tay đòn piston trợ lực kéo xuống vừa tầm với người đứng bếp
                  </span>
                </div>
              </div>

              {/* UB03: Nâng hạ điện */}
              <div
                onClick={() => setDishElectric(!dishElectric)}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                {dishElectric ? (
                  <CheckSquare2 className="w-4 h-4 text-sky-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600 shrink-0" />
                )}
                <div className="flex-1">
                  <span className="font-bold text-slate-200">
                    Giá bát nâng hạ điện thông minh (UB03)
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Cảm ứng 1 chạm tự động nâng hạ motor điện êm ái
                  </span>
                </div>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-300 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Quy tắc chuẩn: Nếu chọn cả giá bát cố định và nâng hạ, hệ thống sẽ tự động đặt giá bát cố định thẳng tim chậu rửa, giá bát nâng hạ nằm trên máy rửa bát.
              </span>
            </div>
          </div>

          {/* 3. KHOANG GIÁ GIA VỊ TỦ TRÊN */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <h4 className="font-bold text-teal-400 flex items-center gap-1.5">
              <span>Khoang Giá Gia Vị Tủ Trên (Tùy chọn)</span>
            </h4>

            <div className="space-y-2 pl-1">
              <div
                onClick={() => setSpiceManual(!spiceManual)}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                {spiceManual ? (
                  <CheckSquare2 className="w-4 h-4 text-teal-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600 shrink-0" />
                )}
                <div>
                  <span className="font-bold text-slate-200">
                    Giá gia vị nâng hạ cơ (UG01)
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Kéo xuống đặt gần khu vực nấu nướng (600mm)
                  </span>
                </div>
              </div>

              <div
                onClick={() => setSpiceElectric(!spiceElectric)}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                {spiceElectric ? (
                  <CheckSquare2 className="w-4 h-4 text-teal-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600 shrink-0" />
                )}
                <div>
                  <span className="font-bold text-slate-200">
                    Giá gia vị nâng hạ điện thông minh (UG02)
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Nâng hạ tự động cảm ứng chống kẹt an toàn
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. KHOANG TỦ CHỨA ĐỒ TỦ TRÊN */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2.5">
              <CheckSquare2 className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h4 className="font-bold text-amber-400">
                  Khoang tủ chứa đồ tủ trên (UT01)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tự động chia và lấp kín toàn bộ khoảng trống còn lại (kích thước mỗi khoang $\le 900$mm và $\ge 300$mm, có thể tinh chỉnh linh hoạt bằng tính năng Auto-Fit).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold transition"
          >
            Hủy
          </button>
          <button
            onClick={handleGenerateUpper}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center gap-2 transition active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>Tạo Tủ Trên & Xem Thiết Kế ➔</span>
          </button>
        </div>
      </div>
    </div>
  );
};
