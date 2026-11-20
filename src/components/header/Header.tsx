import React from 'react';
import { useKitchenStore } from '../../store/useKitchenStore';
import { KitchenShape } from '../../types';
import {
  Undo2,
  Redo2,
  Download,
  Share2,
  Sparkles,
  SlidersHorizontal,
  FileCode,
  LayoutGrid,
  ChefHat,
  Save,
} from 'lucide-react';
import html2canvas from 'html2canvas';

interface HeaderProps {
  onOpenDimensionsModal: () => void;
  onOpenProjectModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenDimensionsModal,
  onOpenProjectModal,
}) => {
  const {
    layout,
    canUndo,
    canRedo,
    undo,
    redo,
    updateShape,
    runLayoutGenerator,
    saveCurrentProject,
    resetToSetupWizard,
  } = useKitchenStore();

  // Export bản vẽ thành file PNG
  const handleExportPNG = async () => {
    const canvasElement = document.querySelector('svg#canvas-bg') as HTMLElement;
    if (!canvasElement) return;

    try {
      // Tải dưới dạng file SVG trực tiếp
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(canvasElement);
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${layout.name || 'kitchen-layout'}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export error', err);
    }
  };

  // Export JSON dữ liệu thiết kế
  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(layout, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${layout.name || 'kitchen-layout'}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-20 select-none">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
          <ChefHat className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <span>Kitchen Layout Designer</span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
              v2.0 CAD
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 font-mono">
            {layout.name || 'Bản thiết kế không tên'} • {layout.placedModules.length} khoang
          </p>
        </div>
      </div>

      {/* Bộ chọn Kiểu bếp (I, L, U) & Kích thước */}
      <div className="flex items-center gap-2">
        <button
          onClick={resetToSetupWizard}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-500/20 transition active:scale-95"
          title="Tạo thiết kế mới (Chọn mẫu bếp, kích thước mặt bằng và chọn khoang tủ dưới)"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Thiết kế mới</span>
        </button>

        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          {(['I', 'L', 'U'] as KitchenShape[]).map((shape) => (
            <button
              key={shape}
              onClick={() => updateShape(shape)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                layout.shape === shape
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Bếp chữ {shape}
            </button>
          ))}
        </div>

        {/* Nút Mở cấu hình kích thước mặt bằng */}
        <button
          onClick={onOpenDimensionsModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-200 transition"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
          <span>Kích thước mặt bằng</span>
        </button>
      </div>

      {/* Action Controls & Export */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Hoàn tác (Ctrl+Z)"
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-900 transition"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Làm lại (Ctrl+Y)"
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-900 transition"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Nút Sinh phương án tối ưu */}
        <button
          onClick={runLayoutGenerator}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-md hover:shadow-emerald-500/20 transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Sinh phương án</span>
        </button>

        {/* Nút Lưu bản thiết kế */}
        <button
          onClick={() => saveCurrentProject()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium transition"
        >
          <Save className="w-3.5 h-3.5 text-purple-400" />
          <span>Lưu</span>
        </button>

        {/* Export SVG / JSON dropdown */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleExportPNG}
            title="Xuất bản vẽ SVG kỹ thuật"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Xuất SVG</span>
          </button>

          <button
            onClick={handleExportJSON}
            title="Xuất file JSON"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
          >
            <FileCode className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
