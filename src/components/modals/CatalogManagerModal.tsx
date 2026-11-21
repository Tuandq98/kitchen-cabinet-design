import React, { useState, useEffect } from 'react';
import { useKitchenStore } from '../../store/useKitchenStore';
import { KitchenModule, ModuleCategory, ModuleVariant } from '../../types';
import {
  X,
  Plus,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Boxes,
  Check,
  Palette,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface CatalogManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  { label: 'Đỏ', hex: '#ef4444' },
  { label: 'Cam', hex: '#f97316' },
  { label: 'Hổ phách', hex: '#f59e0b' },
  { label: 'Xanh lá', hex: '#10b981' },
  { label: 'Xanh cyan', hex: '#06b6d4' },
  { label: 'Xanh sky', hex: '#0ea5e9' },
  { label: 'Xanh dương', hex: '#3b82f6' },
  { label: 'Tím', hex: '#8b5cf6' },
  { label: 'Hồng', hex: '#ec4899' },
  { label: 'Xám đá', hex: '#64748b' },
];

export const CatalogManagerModal: React.FC<CatalogManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    catalog,
    addCatalogModule,
    updateCatalogModule,
    deleteCatalogModule,
    importCatalog,
    resetCatalogToDefault,
  } = useKitchenStore();

  const [editingModule, setEditingModule] = useState<KitchenModule | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ModuleCategory>('cooking');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#38bdf8');
  const [variants, setVariants] = useState<ModuleVariant[]>([]);

  // Variant subform
  const [newVarWidth, setNewVarWidth] = useState<number | string>(600);
  const [newVarDepth, setNewVarDepth] = useState<number | string>(600);
  const [newVarHeight, setNewVarHeight] = useState<number | string>(850);

  // Unsaved changes confirm dialog
  const [pendingTarget, setPendingTarget] = useState<
    | { type: 'select'; module: KitchenModule }
    | { type: 'addNew' }
    | { type: 'close' }
    | null
  >(null);

  // Khi modal mở, tự động chọn khoang đầu tiên để chỉnh sửa nếu chưa chọn
  useEffect(() => {
    if (isOpen && catalog.length > 0 && !editingModule && !isAddingNew) {
      loadModuleIntoForm(catalog[0]);
    }
  }, [isOpen, catalog]);

  if (!isOpen) return null;

  const loadModuleIntoForm = (mod: KitchenModule) => {
    setEditingModule(mod);
    setIsAddingNew(false);
    setCode(mod.code);
    setName(mod.name);
    setCategory(mod.category);
    setDescription(mod.description || '');
    setColor(mod.color || '#38bdf8');
    setVariants([...mod.variants]);
  };

  const setupAddNewForm = () => {
    setEditingModule(null);
    setIsAddingNew(true);
    setCode(`M${Math.floor(Math.random() * 90 + 10)}`);
    setName('Khoang mới');
    setCategory('storage');
    setDescription('');
    setColor('#38bdf8');
    setVariants([
      { id: `var-${Date.now()}`, width: 600, depth: 600, height: 850, isDefault: true },
    ]);
  };

  // Kiểm tra xem form hiện tại có bị thay đổi (dirty) so với bản gốc chưa
  const hasUnsavedChanges = (): boolean => {
    if (isAddingNew) {
      // Nếu đang thêm mới mà đã gõ tên khác hoặc thêm description hoặc đổi kích thước
      return (
        name !== 'Khoang mới' ||
        description !== '' ||
        variants.length > 1 ||
        variants[0]?.width !== 600
      );
    }

    if (!editingModule) return false;

    // So sánh với module gốc
    if (code !== editingModule.code) return true;
    if (name !== editingModule.name) return true;
    if (category !== editingModule.category) return true;
    if ((description || '') !== (editingModule.description || '')) return true;
    if (color !== editingModule.color) return true;

    // So sánh variants
    if (variants.length !== editingModule.variants.length) return true;
    for (let i = 0; i < variants.length; i++) {
      const vCur = variants[i];
      const vOrig = editingModule.variants[i];
      if (!vOrig) return true;
      if (
        vCur.width !== vOrig.width ||
        vCur.depth !== vOrig.depth ||
        vCur.height !== vOrig.height
      ) {
        return true;
      }
    }

    return false;
  };

  // Khi người dùng click vào một khoang
  const handleSelectModule = (targetMod: KitchenModule) => {
    if (editingModule?.id === targetMod.id && !isAddingNew) {
      return; // Đang chọn chính khoang này
    }

    if (hasUnsavedChanges()) {
      setPendingTarget({ type: 'select', module: targetMod });
    } else {
      loadModuleIntoForm(targetMod);
    }
  };

  // Khi click "Thêm khoang mới"
  const handleAddNewClick = () => {
    if (isAddingNew) return;

    if (hasUnsavedChanges()) {
      setPendingTarget({ type: 'addNew' });
    } else {
      setupAddNewForm();
    }
  };

  // Khi click đóng modal
  const handleCloseModal = () => {
    if (hasUnsavedChanges()) {
      setPendingTarget({ type: 'close' });
    } else {
      onClose();
    }
  };

  // Xác nhận lưu thông tin từ popup confirm
  const handleConfirmSave = () => {
    saveCurrentForm();
    applyPendingTarget();
  };

  // Bỏ qua thay đổi và chuyển tiếp
  const handleConfirmDiscard = () => {
    applyPendingTarget();
  };

  // Hủy bỏ việc chuyển (tiếp tục sửa)
  const handleConfirmCancel = () => {
    setPendingTarget(null);
  };

  const applyPendingTarget = () => {
    if (!pendingTarget) return;

    if (pendingTarget.type === 'select') {
      loadModuleIntoForm(pendingTarget.module);
    } else if (pendingTarget.type === 'addNew') {
      setupAddNewForm();
    } else if (pendingTarget.type === 'close') {
      onClose();
    }

    setPendingTarget(null);
  };

  const saveCurrentForm = (): boolean => {
    if (!code.trim() || !name.trim()) {
      alert('Vui lòng nhập đầy đủ Mã khoang và Tên khoang');
      return false;
    }

    const payload: KitchenModule = {
      id: editingModule ? editingModule.id : `mod-${Date.now()}`,
      code: code.trim(),
      name: name.trim(),
      category,
      description: description.trim(),
      color,
      variants,
      metadata: editingModule?.metadata || {},
    };

    if (editingModule) {
      updateCatalogModule(payload);
      setEditingModule(payload);
    } else {
      addCatalogModule(payload);
      setIsAddingNew(false);
      setEditingModule(payload);
    }

    return true;
  };

  const handleManualSave = () => {
    if (saveCurrentForm()) {
      alert(`Đã lưu thành công khoang "${name}"!`);
    }
  };

  const handleAddVariant = () => {
    setVariants([
      ...variants,
      {
        id: `var-${Date.now()}`,
        width: Number(newVarWidth) || 600,
        depth: Number(newVarDepth) || 600,
        height: Number(newVarHeight) || 850,
      },
    ]);
  };

  const handleRemoveVariant = (id: string) => {
    if (variants.length <= 1) {
      alert('Khoang phải có ít nhất 1 biến thể kích thước!');
      return;
    }
    setVariants(variants.filter((v) => v.id !== id));
  };

  // Export JSON
  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(catalog, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'kitchen-modules-catalog.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export CSV
  const handleExportCSV = () => {
    let csv = 'Mã khoang,Tên khoang,Danh mục,Màu sắc,Chiều rộng,Chiều sâu,Chiều cao\n';
    for (const mod of catalog) {
      for (const v of mod.variants) {
        csv += `"${mod.code}","${mod.name}","${mod.category}","${mod.color || '#38bdf8'}",${v.width},${v.depth},${v.height}\n`;
      }
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kitchen-modules-catalog.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import JSON / CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            importCatalog(parsed);
            if (parsed.length > 0) loadModuleIntoForm(parsed[0]);
            alert(`Đã nạp thành công ${parsed.length} khoang từ file JSON!`);
          }
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n');
          const newMods: KitchenModule[] = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',').map((p) => p.replace(/"/g, ''));
            if (parts.length >= 6) {
              const [mCode, mName, mCat, mColorOrW, mWOrD, mDOrH, mH] = parts;
              const hasColor = parts.length >= 7;
              const mColor = hasColor ? mColorOrW : '#38bdf8';
              const widthVal = Number(hasColor ? mWOrD : mColorOrW) || 600;
              const depthVal = Number(hasColor ? mDOrH : mWOrD) || 600;
              const heightVal = Number(hasColor ? mH : mDOrH) || 850;

              newMods.push({
                id: `mod-csv-${i}`,
                code: mCode,
                name: mName,
                category: (mCat as any) || 'storage',
                color: mColor,
                variants: [
                  {
                    id: `var-csv-${i}`,
                    width: widthVal,
                    depth: depthVal,
                    height: heightVal,
                  },
                ],
                metadata: {},
              });
            }
          }
          if (newMods.length > 0) {
            importCatalog(newMods);
            loadModuleIntoForm(newMods[0]);
            alert(`Đã nạp thành công ${newMods.length} khoang từ file CSV!`);
          }
        }
      } catch (err) {
        alert('File không hợp lệ: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/10 rounded-xl text-sky-400">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Quản lý Danh mục Khoang công năng</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {catalog.length} khoang
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Phân biệt khoang bằng màu sắc nhận diện, sửa trực tiếp khi click và quản lý biến thể kích thước
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Cột trái: Danh sách khoang có màu sắc nhận diện */}
          <div className="w-1/2 border-r border-slate-800 flex flex-col p-4 space-y-3 bg-slate-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Chọn khoang để xem & chỉnh sửa:
              </span>
              <button
                onClick={handleAddNewClick}
                className={`flex items-center gap-1 px-2.5 py-1 text-white rounded-lg text-xs font-semibold shadow-sm transition ${
                  isAddingNew
                    ? 'bg-emerald-600 ring-2 ring-emerald-400/40'
                    : 'bg-sky-600 hover:bg-sky-500'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm khoang mới</span>
              </button>
            </div>

            {/* Danh sách khoang (Click vào toàn bộ card để sửa) */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {catalog.map((mod) => {
                const isSelected = editingModule?.id === mod.id && !isAddingNew;
                const modColor = mod.color || '#38bdf8';

                return (
                  <div
                    key={mod.id}
                    onClick={() => handleSelectModule(mod)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition relative overflow-hidden group ${
                      isSelected
                        ? 'bg-slate-800/90 border-sky-400 shadow-md ring-1 ring-sky-400/30'
                        : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    {/* Dải màu nhận diện cạnh trái */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1.5 transition-all"
                      style={{ backgroundColor: modColor }}
                    />

                    <div className="flex items-center gap-2.5 pl-1.5">
                      {/* Chấm màu nhận diện */}
                      <div
                        className="w-4 h-4 rounded-full shrink-0 shadow-sm border border-white/20"
                        style={{ backgroundColor: modColor }}
                        title={`Màu sắc: ${modColor}`}
                      />

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border"
                            style={{
                              backgroundColor: `${modColor}20`,
                              color: modColor,
                              borderColor: `${modColor}40`,
                            }}
                          >
                            {mod.code}
                          </span>
                          <h4 className="text-xs font-bold text-slate-100 group-hover:text-sky-300 transition-colors">
                            {mod.name}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {mod.variants.length} biến thể • ({mod.variants.map((v) => v.width).join(', ')} mm)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isSelected && (
                        <span className="text-[10px] font-medium text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 mr-1">
                          Đang sửa
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Bạn có chắc chắn muốn xóa khoang "${mod.name}" khỏi danh mục?`)) {
                            deleteCatalogModule(mod.id);
                            if (editingModule?.id === mod.id) {
                              setEditingModule(null);
                            }
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                        title="Xóa khoang"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                  title="Xuất file JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                  title="Xuất file CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <label
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  title="Nạp file JSON/CSV"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Nạp file</span>
                  <input
                    type="file"
                    accept=".json,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                onClick={() => {
                  if (confirm('Khôi phục danh mục về mẫu ban đầu?')) {
                    resetCatalogToDefault();
                  }
                }}
                className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục mẫu</span>
              </button>
            </div>
          </div>

          {/* Cột phải: Form Thêm / Chỉnh sửa khoang */}
          <div className="w-1/2 p-4 flex flex-col space-y-3 overflow-y-auto">
            {editingModule || isAddingNew ? (
              <div className="space-y-3.5 text-xs">
                {/* Header form */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <h4 className="font-bold text-slate-100 text-sm">
                      {isAddingNew
                        ? 'Thêm khoang công năng mới'
                        : `Chỉnh sửa khoang: ${editingModule?.name}`}
                    </h4>
                  </div>
                  {hasUnsavedChanges() && (
                    <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1 animate-pulse">
                      <AlertCircle className="w-3 h-3" />
                      <span>Có thay đổi chưa lưu</span>
                    </span>
                  )}
                </div>

                {/* BẢNG CHỌN MÀU SẮC NHẬN DIỆN */}
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-sky-400" />
                      <span>Màu sắc nhận diện khoang:</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        title="Chọn màu tự do"
                      />
                      <span className="font-mono text-[11px] text-slate-400 uppercase">
                        {color}
                      </span>
                    </div>
                  </div>

                  {/* Preset colors palette */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {PRESET_COLORS.map((pc) => (
                      <button
                        key={pc.hex}
                        type="button"
                        onClick={() => setColor(pc.hex)}
                        title={pc.label}
                        className={`w-6 h-6 rounded-lg transition-transform border ${
                          color.toLowerCase() === pc.hex.toLowerCase()
                            ? 'scale-110 ring-2 ring-white border-white shadow-md'
                            : 'border-transparent hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: pc.hex }}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Mã khoang</label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="VD: B01, S01..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Danh mục</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="cooking">Bếp nấu (cooking)</option>
                      <option value="sink">Chậu rửa (sink)</option>
                      <option value="refrigeration">Tủ lạnh (refrigeration)</option>
                      <option value="appliance">Thiết bị (appliance)</option>
                      <option value="storage">Lưu trữ (storage)</option>
                      <option value="prep">Sơ chế/dao thớt (prep)</option>
                      <option value="corner">Khoang góc (corner)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Tên khoang</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Khoang bếp nấu"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Mô tả công năng</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mô tả phụ kiện, công năng và lưu ý kỹ thuật..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Quản lý Biến thể Kích thước (Variants) */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">
                      Biến thể kích thước (Variants)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {variants.length} biến thể
                    </span>
                  </div>

                  {/* List variants */}
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-[11px]"
                      >
                        <span className="text-slate-200">
                          {v.width} × {v.depth} × {v.height} mm
                        </span>
                        <button
                          onClick={() => handleRemoveVariant(v.id)}
                          className="text-slate-500 hover:text-red-400 transition"
                          title="Xóa biến thể"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add variant row */}
                  <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 space-y-2">
                    <span className="text-[11px] text-slate-400 block font-medium">
                      Thêm kích thước mới cho khoang này:
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Rộng (mm)</span>
                        <input
                          type="number"
                          value={newVarWidth}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setNewVarWidth(e.target.value === '' ? '' : Number(e.target.value))}
                          onBlur={() => {
                            if (!newVarWidth || Number(newVarWidth) <= 0) setNewVarWidth(600);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Sâu (mm)</span>
                        <input
                          type="number"
                          value={newVarDepth}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setNewVarDepth(e.target.value === '' ? '' : Number(e.target.value))}
                          onBlur={() => {
                            if (!newVarDepth || Number(newVarDepth) <= 0) setNewVarDepth(600);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Cao (mm)</span>
                        <input
                          type="number"
                          value={newVarHeight}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setNewVarHeight(e.target.value === '' ? '' : Number(e.target.value))}
                          onBlur={() => {
                            if (!newVarHeight || Number(newVarHeight) <= 0) setNewVarHeight(850);
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200 text-xs"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddVariant}
                      className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded text-[11px] font-medium transition"
                    >
                      + Thêm biến thể kích thước
                    </button>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => {
                      if (isAddingNew && catalog.length > 0) {
                        loadModuleIntoForm(catalog[0]);
                      } else if (editingModule) {
                        loadModuleIntoForm(editingModule); // Revert
                      }
                    }}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition"
                  >
                    Khôi phục
                  </button>
                  <button
                    onClick={handleManualSave}
                    className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>Lưu thay đổi khoang</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs p-6 space-y-2">
                <Boxes className="w-10 h-10 opacity-30 text-slate-400" />
                <p>
                  Chọn một khoang bên trái để xem và chỉnh sửa thông tin.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* HỘP THOẠI XÁC NHẬN KHI CÓ THAY ĐỔI CHƯA LƯU */}
        {pendingTarget && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-30 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-100">
                    Bạn có thông tin chưa lưu!
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Khoang <span className="font-bold text-sky-400">"{name}"</span> đang có những thay đổi chưa được lưu. Bạn có muốn lưu lại trước khi chuyển sang khoang khác không?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={handleConfirmCancel}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Tiếp tục sửa
                </button>
                <button
                  onClick={handleConfirmDiscard}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  Bỏ qua (Không lưu)
                </button>
                <button
                  onClick={handleConfirmSave}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md transition flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Lưu & Chuyển</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
