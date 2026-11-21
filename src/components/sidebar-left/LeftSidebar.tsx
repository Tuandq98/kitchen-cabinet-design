import React, { useState } from 'react';
import { useKitchenStore } from '../../store/useKitchenStore';
import { ModuleCategory, KitchenModule } from '../../types';
import {
  Boxes,
  ShieldCheck,
  Sparkles,
  FolderKanban,
  Search,
  Plus,
  Settings,
  ChevronRight,
  Flame,
  Droplets,
  Refrigerator,
  Microwave,
  Archive,
  UtensilsCrossed,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sliders,
  Trash2,
  ArrowRight,
  Download,
  Upload,
  X,
} from 'lucide-react';

function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function matchesModuleSearch(mod: KitchenModule, query: string): boolean {
  if (!query) return true;
  const rawTerm = query.trim().toLowerCase();
  if (!rawTerm) return true;

  // 1. Khớp mã khoang (VD: F01, B01, UB01)
  const codeLower = mod.code.toLowerCase();
  if (codeLower.includes(rawTerm)) return true;

  const cleanTerm = removeVietnameseTones(rawTerm);
  const nameClean = removeVietnameseTones(mod.name);
  const nameLower = mod.name.toLowerCase();

  const hasTones = rawTerm !== cleanTerm;
  if (hasTones) {
    // Người dùng gõ có dấu (VD: "tủ", "bếp", "chậu") -> khớp chính xác tên hiển thị có dấu
    return nameLower.includes(rawTerm);
  } else {
    // Người dùng gõ không dấu (VD: "tu", "bep", "chau") -> khớp không dấu tên hiển thị
    return nameClean.includes(cleanTerm);
  }
}

interface LeftSidebarProps {
  onOpenCatalogModal: () => void;
  onOpenRulesModal: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  onOpenCatalogModal,
  onOpenRulesModal,
}) => {
  const {
    catalog,
    rules,
    activeTab,
    generatedCandidates,
    selectedCandidateIndex,
    generationError,
    savedProjects,
    layout,
    selectedModuleCodes,
    setActiveTab,
    toggleRule,
    addModuleToEdge,
    runLayoutGenerator,
    applyCandidate,
    loadProject,
    deleteProject,
    saveCurrentProject,
  } = useKitchenStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<'all' | 'base' | 'upper'>('all');
  const [projectNameInput, setProjectNameInput] = useState('');

  // Icon theo danh mục
  const getCategoryIcon = (category: ModuleCategory) => {
    switch (category) {
      case 'cooking':
        return <Flame className="w-4 h-4 text-red-400" />;
      case 'sink':
        return <Droplets className="w-4 h-4 text-sky-400" />;
      case 'refrigeration':
        return <Refrigerator className="w-4 h-4 text-blue-400" />;
      case 'appliance':
        return <Microwave className="w-4 h-4 text-purple-400" />;
      case 'storage':
        return <Archive className="w-4 h-4 text-amber-400" />;
      case 'prep':
        return <UtensilsCrossed className="w-4 h-4 text-emerald-400" />;
      default:
        return <Boxes className="w-4 h-4 text-slate-400" />;
    }
  };

  // Lọc catalog (tìm kiếm theo tên hiển thị và mã khoang, hỗ trợ cả tiếng Việt có dấu và không dấu)
  const filteredCatalog = catalog.filter((mod) => {
    const matchesSearch = matchesModuleSearch(mod, searchTerm);
    const matchesCat =
      selectedCategory === 'all' || mod.category === selectedCategory;
    const matchesTier =
      selectedTier === 'all' || (mod.tier || 'base') === selectedTier;
    return matchesSearch && matchesCat && matchesTier;
  });

  return (
    <aside className="w-80 h-full flex flex-col bg-slate-900 border-r border-slate-800 z-10 select-none">
      {/* Tab Navigation Headers */}
      <div className="flex border-b border-slate-800 bg-slate-950/60 p-1">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-medium rounded-lg transition ${
            activeTab === 'catalog'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Thư viện khoang công năng"
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Khoang</span>
        </button>

        <button
          onClick={() => setActiveTab('generator')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-medium rounded-lg transition ${
            activeTab === 'generator'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Sinh phương án tự động"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gợi ý</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-medium rounded-lg transition ${
            activeTab === 'rules'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Quy tắc thiết kế"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Quy tắc</span>
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-medium rounded-lg transition ${
            activeTab === 'projects'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Dự án đã lưu"
        >
          <FolderKanban className="w-3.5 h-3.5" />
          <span>Lưu</span>
        </button>
      </div>

      {/* TAB CONTENT 1: THƯ VIỆN KHOANG CÔNG NĂNG */}
      {activeTab === 'catalog' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Search & Actions Bar */}
          <div className="p-3 border-b border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tìm nhanh tên hoặc mã khoang..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 shadow-inner"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tier Filter Toggle (Tất cả / Tủ Dưới / Tủ Trên) */}
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
              {[
                { id: 'all', label: 'Tất cả tầng' },
                { id: 'base', label: 'Tủ Dưới' },
                { id: 'upper', label: 'Tủ Trên' },
              ].map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id as any)}
                  className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition ${
                    selectedTier === tier.id
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'cooking', label: 'Bếp' },
                { id: 'sink', label: 'Chậu' },
                { id: 'refrigeration', label: 'Tủ lạnh' },
                { id: 'appliance', label: 'Thiết bị' },
                { id: 'storage', label: 'Tủ chứa' },
                { id: 'prep', label: 'Sơ chế' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2 py-0.5 whitespace-nowrap rounded-md text-[11px] transition ${
                    selectedCategory === cat.id
                      ? 'bg-sky-500 text-white font-medium'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-[11px] text-slate-500">
                {filteredCatalog.length} khoang khả dụng
              </span>
              <button
                onClick={onOpenCatalogModal}
                className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium"
              >
                <Settings className="w-3 h-3" />
                <span>Quản lý danh mục</span>
              </button>
            </div>
          </div>

          {/* Catalog Modules List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredCatalog.map((mod) => {
              const defaultVar = mod.variants.find((v) => v.isDefault) || mod.variants[0];
              const isCornerDisabledInShapeI =
                layout.shape === 'I' && (mod.code === 'K01' || mod.category === 'corner');

              return (
                <div
                  key={mod.id}
                  draggable={!isCornerDisabledInShapeI}
                  onDragStart={(e) => {
                    if (isCornerDisabledInShapeI) return;
                    e.dataTransfer.setData('application/kitchen-module', mod.id);
                    e.dataTransfer.setData('application/kitchen-tier', mod.tier || 'base');
                  }}
                  className={`bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 transition group relative overflow-hidden pl-3.5 ${
                    isCornerDisabledInShapeI
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:border-slate-700 cursor-grab active:cursor-grabbing hover:shadow-md'
                  }`}
                >
                  {/* Dải màu nhận diện cạnh trái */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5"
                    style={{ backgroundColor: mod.color || '#38bdf8' }}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-1.5 rounded-lg border"
                        style={{
                          backgroundColor: `${mod.color || '#38bdf8'}15`,
                          borderColor: `${mod.color || '#38bdf8'}30`,
                        }}
                      >
                        {getCategoryIcon(mod.category)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border"
                            style={{
                              backgroundColor: `${mod.color || '#38bdf8'}20`,
                              color: mod.color || '#38bdf8',
                              borderColor: `${mod.color || '#38bdf8'}40`,
                            }}
                          >
                            {mod.code}
                          </span>
                          <h4 className="text-xs font-semibold text-slate-200">
                            {mod.name}
                          </h4>
                          {isCornerDisabledInShapeI && (
                            <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 rounded">
                              Chỉ bếp L/U
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                          {defaultVar ? `${defaultVar.width} × ${defaultVar.depth} × ${defaultVar.height} mm` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Quick Add Menu */}
                    {isCornerDisabledInShapeI ? (
                      <span className="text-[9px] font-semibold text-amber-400/70 px-1 py-0.5">
                        Không khả dụng
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => addModuleToEdge(mod.id, 'edge_A')}
                          title="Thêm vào Cạnh A"
                          className="p-1 bg-slate-800 hover:bg-sky-500 text-slate-300 hover:text-white rounded text-[10px] font-mono transition"
                        >
                          +A
                        </button>
                        {layout.shape !== 'I' && (
                          <button
                            onClick={() => addModuleToEdge(mod.id, 'edge_B')}
                            title="Thêm vào Cạnh B"
                            className="p-1 bg-slate-800 hover:bg-sky-500 text-slate-300 hover:text-white rounded text-[10px] font-mono transition"
                          >
                            +B
                          </button>
                        )}
                        {layout.shape === 'U' && (
                          <button
                            onClick={() => addModuleToEdge(mod.id, 'edge_C')}
                            title="Thêm vào Cạnh C"
                            className="p-1 bg-slate-800 hover:bg-sky-500 text-slate-300 hover:text-white rounded text-[10px] font-mono transition"
                          >
                            +C
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Biến thể kích thước */}
                  {mod.variants.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <span>{mod.variants.length} biến thể rộng:</span>
                      <div className="flex gap-1 flex-wrap font-mono">
                        {mod.variants.map((v) => (
                          <span
                            key={v.id}
                            className="bg-slate-900 px-1 rounded text-slate-400"
                          >
                            {v.width}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: GỢI Ý BỐ TRÍ TỰ ĐỘNG (LAYOUT GENERATOR) */}
      {activeTab === 'generator' && (
        <div className="flex-1 flex flex-col min-h-0 p-3 space-y-3">
          {/* Header Action Button */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Thuật toán Tối ưu Bố trí</span>
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tự động sinh các phương án tối ưu dựa trên quy tắc Tam giác công năng NKBA, khoảng cách an toàn và kích thước thực tế.
            </p>

            {/* Active base module codes on canvas */}
            <div className="pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span>Khoang trên mặt bằng ({layout.placedModules.length}):</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {layout.placedModules.map((m) => (
                  <span
                    key={m.instanceId}
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                    style={{
                      backgroundColor: `${m.color}25`,
                      color: m.color,
                      border: `1px solid ${m.color}40`,
                    }}
                    title={m.name}
                  >
                    {m.code}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={runLayoutGenerator}
              className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-emerald-500/20 transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Tự động sinh phương án</span>
            </button>
          </div>

          {/* Lỗi sinh layout nếu có */}
          {generationError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Không thể tạo phương án</span>
              </div>
              <p className="text-[11px] text-red-300/90 leading-relaxed">
                {generationError}
              </p>
            </div>
          )}

          {/* Danh sách các phương án sinh ra (Top tối đa 5 phương án) */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
            {generatedCandidates.length > 0 && (
              <div className="text-[11px] font-medium text-slate-400 px-1">
                Tìm thấy {generatedCandidates.length} phương án tối ưu:
              </div>
            )}

            {generatedCandidates.map((cand, idx) => {
              const isSelected = selectedCandidateIndex === idx;
              return (
                <div
                  key={cand.id}
                  onClick={() => applyCandidate(idx)}
                  className={`p-3 rounded-xl border cursor-pointer transition space-y-2 ${
                    isSelected
                      ? 'bg-slate-800/90 border-emerald-500/60 shadow-lg ring-1 ring-emerald-500/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100 line-clamp-1">
                      {cand.title}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {cand.score} điểm
                    </span>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400 font-mono">
                    <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                      Chu vi TG: {cand.workTrianglePerimeter}mm
                    </div>
                    <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800/80">
                      {cand.ruleSummary.passedCount} quy tắc đạt
                    </div>
                  </div>

                  {/* Ưu điểm */}
                  {cand.pros.length > 0 && (
                    <div className="space-y-1">
                      {cand.pros.map((p, pIdx) => (
                        <div
                          key={pIdx}
                          className="flex items-center gap-1 text-[11px] text-emerald-400"
                        >
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span className="line-clamp-1">{p}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cons */}
                  {cand.cons.length > 0 && (
                    <div className="text-[10px] text-slate-500">
                      {cand.cons.join(' • ')}
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      applyCandidate(idx);
                    }}
                    className={`w-full py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    <span>{isSelected ? 'Đang áp dụng' : 'Áp dụng phương án này'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: QUẢN LÝ QUY TẮC THIẾT KẾ (RULE ENGINE) */}
      {activeTab === 'rules' && (
        <div className="flex-1 flex flex-col min-h-0 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              {rules.length} quy tắc kiểm tra
            </span>
            <button
              onClick={onOpenRulesModal}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Cấu hình tham số</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 custom-scrollbar">
            {/* Nhóm 1: Ràng buộc cứng & Vị trí Hệ tủ đứng */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-red-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>Ràng buộc cứng & Vị trí Hệ tủ đứng</span>
              </div>
              {rules
                .filter((r) =>
                  [
                    'RULE_01',
                    'RULE_OVERFLOW',
                    'RULE_02',
                    'RULE_06',
                    'RULE_07',
                    'RULE_08',
                    'RULE_10',
                  ].includes(r.code)
                )
                .map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-3 rounded-xl border transition ${
                      rule.enabled
                        ? 'bg-slate-950/70 border-slate-800'
                        : 'bg-slate-950/30 border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono bg-red-500/20 text-red-400 border border-red-500/30">
                            BẮT BUỘC
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {rule.code}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-200">
                          {rule.name}
                        </h4>
                      </div>

                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => toggleRule(rule.id)}
                        className="w-4 h-4 accent-red-500 rounded cursor-pointer mt-0.5"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      {rule.description}
                    </p>
                  </div>
                ))}
            </div>

            {/* Nhóm 2: Khoảng cách, Công thái học & Bố trí đối trọng */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Khoảng cách & Bố trí đối trọng NKBA</span>
              </div>
              {rules
                .filter((r) => ['RULE_09', 'RULE_05', 'RULE_03'].includes(r.code))
                .map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-3 rounded-xl border transition ${
                      rule.enabled
                        ? 'bg-slate-950/70 border-slate-800'
                        : 'bg-slate-950/30 border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            {rule.code === 'RULE_09' ? 'ĐỐI TRỌNG CÂN ĐỐI' : 'ƯU TIÊN (SOFT)'}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {rule.code}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-200">
                          {rule.name}
                        </h4>
                      </div>

                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => toggleRule(rule.id)}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer mt-0.5"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      {rule.description}
                    </p>
                  </div>
                ))}
            </div>

            {/* Nhóm 3: Bố trí các khoang phụ trợ & Dây chuyền công năng */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Dây chuyền thao tác & Khoang phụ trợ</span>
              </div>
              {rules
                .filter((r) => ['RULE_04A', 'RULE_04B', 'RULE_04C', 'RULE_04D'].includes(r.code))
                .map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-3 rounded-xl border transition ${
                      rule.enabled
                        ? 'bg-slate-950/70 border-slate-800'
                        : 'bg-slate-950/30 border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {rule.code === 'RULE_04D' ? 'THỨ TỰ (ORDER)' : 'LIỀN KỀ'}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {rule.code}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-200">
                          {rule.name}
                        </h4>
                      </div>

                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => toggleRule(rule.id)}
                        className="w-4 h-4 accent-emerald-500 rounded cursor-pointer mt-0.5"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      {rule.description}
                    </p>
                  </div>
                ))}
            </div>

            {/* Nhóm 4: Quy tắc Tủ Trên (Upper Cabinets) */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                <span>Quy tắc Tủ Trên (Upper Cabinets)</span>
              </div>
              {rules
                .filter((r) =>
                  [
                    'RULE_U01',
                    'RULE_U02',
                    'RULE_U03',
                    'RULE_U04',
                    'RULE_U05',
                  ].includes(r.code)
                )
                .map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-3 rounded-xl border transition ${
                      rule.enabled
                        ? 'bg-slate-950/70 border-slate-800'
                        : 'bg-slate-950/30 border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                              rule.severity === 'ERROR'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            }`}
                          >
                            {rule.severity === 'ERROR' ? 'BẮT BUỘC' : 'CĂN TIM / ƯU TIÊN'}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {rule.code}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-200">
                          {rule.name}
                        </h4>
                      </div>

                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => toggleRule(rule.id)}
                        className="w-4 h-4 accent-sky-500 rounded cursor-pointer mt-0.5"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                      {rule.description}
                    </p>
                  </div>
                ))}
            </div>

            {/* Nhóm 5: Quy tắc mở rộng khác (nếu có bất kỳ quy tắc nào chưa thuộc 4 nhóm trên) */}
            {rules.filter(
              (r) =>
                ![
                  'RULE_01',
                  'RULE_OVERFLOW',
                  'RULE_02',
                  'RULE_06',
                  'RULE_07',
                  'RULE_08',
                  'RULE_10',
                  'RULE_09',
                  'RULE_05',
                  'RULE_03',
                  'RULE_04A',
                  'RULE_04B',
                  'RULE_04C',
                  'RULE_04D',
                  'RULE_U01',
                  'RULE_U02',
                  'RULE_U03',
                  'RULE_U04',
                  'RULE_U05',
                ].includes(r.code)
            ).length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>Quy tắc bổ sung khác</span>
                </div>
                {rules
                  .filter(
                    (r) =>
                      ![
                        'RULE_01',
                        'RULE_OVERFLOW',
                        'RULE_02',
                        'RULE_06',
                        'RULE_07',
                        'RULE_08',
                        'RULE_10',
                        'RULE_09',
                        'RULE_05',
                        'RULE_03',
                        'RULE_04A',
                        'RULE_04B',
                        'RULE_04C',
                        'RULE_04D',
                        'RULE_U01',
                        'RULE_U02',
                        'RULE_U03',
                        'RULE_U04',
                        'RULE_U05',
                      ].includes(r.code)
                  )
                  .map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-3 rounded-xl border transition ${
                        rule.enabled
                          ? 'bg-slate-950/70 border-slate-800'
                          : 'bg-slate-950/30 border-slate-900 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">
                              {rule.severity}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              {rule.code}
                            </span>
                          </div>
                          <h4 className="text-xs font-semibold text-slate-200">
                            {rule.name}
                          </h4>
                        </div>

                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => toggleRule(rule.id)}
                          className="w-4 h-4 accent-purple-500 rounded cursor-pointer mt-0.5"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                        {rule.description}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: DỰ ÁN ĐÃ LƯU (PERSISTENCE) */}
      {activeTab === 'projects' && (
        <div className="flex-1 flex flex-col min-h-0 p-3 space-y-3">
          {/* Form Lưu Bản Thiết Kế */}
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-200">Lưu bản thiết kế này</h4>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder={layout.name || 'Nhập tên thiết kế...'}
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={() => {
                  saveCurrentProject(projectNameInput || layout.name);
                  setProjectNameInput('');
                }}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition"
              >
                Lưu
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Các bản thiết kế đã lưu ({savedProjects.length})
          </div>

          {/* List Saved Projects */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {savedProjects.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                Chưa có bản thiết kế nào được lưu trong bộ nhớ trình duyệt.
              </div>
            ) : (
              savedProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-3 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl space-y-2 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">
                        {proj.name}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Kiểu bếp chữ {proj.shape} • {proj.placedModules.length} khoang
                      </p>
                    </div>
                    <button
                      onClick={() => deleteProject(proj.id)}
                      className="p-1 text-slate-500 hover:text-red-400 transition"
                      title="Xóa bản thiết kế"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => loadProject(proj.id)}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-medium rounded-lg transition"
                  >
                    Mở bản vẽ này
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
