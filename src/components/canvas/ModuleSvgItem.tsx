import React from 'react';
import { Module2DBox } from '../../utils/geometry';
import { PlacedModuleInstance } from '../../types';

interface ModuleSvgItemProps {
  box: Module2DBox;
  placedModule: PlacedModuleInstance;
  isSelected: boolean;
  isViolated: boolean;
  onSelect: (instanceId: string) => void;
  onDelete: (instanceId: string) => void;
  onMoveLeft: (instanceId: string) => void;
  onMoveRight: (instanceId: string) => void;
  onReorder?: (sourceInstanceId: string, targetInstanceId: string) => void;
}

export const ModuleSvgItem: React.FC<ModuleSvgItemProps> = ({
  box,
  placedModule,
  isSelected,
  isViolated,
  onSelect,
  onDelete,
  onMoveLeft,
  onMoveRight,
  onReorder,
}) => {
  const { x, y, width, height, code, name, category, rotation } = box;

  // Render ký hiệu kỹ thuật 2D mặt bằng kiến trúc nội thất
  const renderArchitecturalDetails = () => {
    switch (category) {
      case 'cooking': // Bếp nấu: các vùng nấu từ tròn và bảng điều khiển
        return (
          <g opacity="0.85">
            {/* Vành kính bếp */}
            <rect
              x={x + 10}
              y={y + 10}
              width={width - 20}
              height={height - 20}
              rx="4"
              fill="#18181b"
              stroke="#ef4444"
              strokeWidth="2"
            />
            {/* Vùng nấu 1 */}
            <circle
              cx={x + width * 0.32}
              cy={y + height * 0.5}
              r={Math.min(width * 0.18, height * 0.3)}
              fill="none"
              stroke="#f87171"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            <circle
              cx={x + width * 0.32}
              cy={y + height * 0.5}
              r={Math.min(width * 0.08, height * 0.14)}
              fill="#ef4444"
              opacity="0.6"
            />
            {/* Vùng nấu 2 */}
            <circle
              cx={x + width * 0.68}
              cy={y + height * 0.5}
              r={Math.min(width * 0.22, height * 0.35)}
              fill="none"
              stroke="#f87171"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
            <circle
              cx={x + width * 0.68}
              cy={y + height * 0.5}
              r={Math.min(width * 0.09, height * 0.15)}
              fill="#ef4444"
              opacity="0.6"
            />
            {/* Touch control bar */}
            <rect
              x={x + width * 0.4}
              y={y + height - 18}
              width={width * 0.2}
              height="4"
              rx="2"
              fill="#fca5a5"
            />
          </g>
        );

      case 'sink': // Chậu rửa bát: 2 hố chậu + vòi rửa
        const bowlWidth = (width - 40) / 2;
        return (
          <g opacity="0.85">
            {/* Viền mặt chậu inox */}
            <rect
              x={x + 8}
              y={y + 8}
              width={width - 16}
              height={height - 16}
              rx="6"
              fill="#0f172a"
              stroke="#0ea5e9"
              strokeWidth="2"
            />
            {/* Hố chậu trái */}
            <rect
              x={x + 14}
              y={y + 14}
              width={bowlWidth}
              height={height - 28}
              rx="4"
              fill="#1e293b"
              stroke="#38bdf8"
              strokeWidth="1.5"
            />
            <circle
              cx={x + 14 + bowlWidth / 2}
              cy={y + height / 2}
              r="6"
              fill="#0ea5e9"
            />
            {/* Hố chậu phải */}
            <rect
              x={x + 22 + bowlWidth}
              y={y + 14}
              width={bowlWidth}
              height={height - 28}
              rx="4"
              fill="#1e293b"
              stroke="#38bdf8"
              strokeWidth="1.5"
            />
            <circle
              cx={x + 22 + bowlWidth + bowlWidth / 2}
              cy={y + height / 2}
              r="6"
              fill="#0ea5e9"
            />
            {/* Vòi nước mixer tap */}
            <circle
              cx={x + width / 2}
              cy={y + 10}
              r="7"
              fill="#e2e8f0"
              stroke="#0284c7"
              strokeWidth="2"
            />
            <line
              x1={x + width / 2}
              y1={y + 10}
              x2={x + width / 2}
              y2={y + 24}
              stroke="#e2e8f0"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        );

      case 'refrigeration': // Tủ lạnh: 2 cánh cửa và tay nắm
        return (
          <g opacity="0.85">
            <rect
              x={x + 6}
              y={y + 6}
              width={width - 12}
              height={height - 12}
              rx="4"
              fill="#1e3a8a"
              stroke="#3b82f6"
              strokeWidth="2"
            />
            {/* Đường phân cách 2 cánh */}
            <line
              x1={x + width / 2}
              y1={y + 8}
              x2={x + width / 2}
              y2={y + height - 8}
              stroke="#60a5fa"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            {/* Tay nắm cửa */}
            <rect
              x={x + width / 2 - 8}
              y={y + height - 16}
              width="4"
              height="8"
              rx="1"
              fill="#93c5fd"
            />
            <rect
              x={x + width / 2 + 4}
              y={y + height - 16}
              width="4"
              height="8"
              rx="1"
              fill="#93c5fd"
            />
          </g>
        );

      case 'appliance':
        // 1. Hút mùi UH01 (Tủ trên)
        if (code === 'UH01') {
          return (
            <g opacity="0.9">
              {/* Thân vỏ hút mùi */}
              <rect
                x={x + 8}
                y={y + 8}
                width={width - 16}
                height={height - 16}
                rx="4"
                fill="#4c0519"
                stroke="#e11d48"
                strokeWidth="2.5"
              />
              {/* Quạt hút mùi tâm tròn */}
              <circle
                cx={x + width / 2}
                cy={y + height / 2}
                r={Math.min(42, height * 0.35)}
                fill="#881337"
                stroke="#fb7185"
                strokeWidth="2"
              />
              <circle
                cx={x + width / 2}
                cy={y + height / 2}
                r="12"
                fill="#f43f5e"
              />
              {/* Lưới lọc mỡ nhôm 2 bên */}
              <rect
                x={x + 18}
                y={y + 16}
                width={Math.max(20, width * 0.22)}
                height={height - 32}
                rx="2"
                fill="#be123c"
                stroke="#fda4af"
                strokeWidth="1.5"
              />
              <rect
                x={x + width - 18 - Math.max(20, width * 0.22)}
                y={y + 16}
                width={Math.max(20, width * 0.22)}
                height={height - 32}
                rx="2"
                fill="#be123c"
                stroke="#fda4af"
                strokeWidth="1.5"
              />
              {/* Đèn LED chiếu sáng 2 đầu */}
              <circle cx={x + 28} cy={y + height - 16} r="4" fill="#fef08a" />
              <circle cx={x + width - 28} cy={y + height - 16} r="4" fill="#fef08a" />
              <text
                x={x + width / 2}
                y={y + height - 14}
                textAnchor="middle"
                fill="#fda4af"
                fontSize="22"
                fontWeight="900"
              >
                HÚT MÙI
              </text>
            </g>
          );
        }

        // 2. Máy rửa bát D01 & lò nướng M01 (Tủ dưới)
        return (
          <g opacity="0.85">
            <rect
              x={x + 6}
              y={y + 6}
              width={width - 12}
              height={height - 12}
              rx="4"
              fill="#312e81"
              stroke="#8b5cf6"
              strokeWidth="2"
            />
            {/* Khay ray ngăn đựng đĩa */}
            <line
              x1={x + 14}
              y1={y + 20}
              x2={x + width - 14}
              y2={y + 20}
              stroke="#a78bfa"
              strokeWidth="1.5"
            />
            <line
              x1={x + 14}
              y1={y + height - 20}
              x2={x + width - 14}
              y2={y + height - 20}
              stroke="#a78bfa"
              strokeWidth="1.5"
            />
            {/* Biểu tượng chén đĩa / vòi xoay */}
            <circle
              cx={x + width / 2}
              cy={y + height / 2}
              r="14"
              fill="none"
              stroke="#c4b5fd"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <circle
              cx={x + width / 2}
              cy={y + height / 2}
              r="4"
              fill="#a78bfa"
            />
          </g>
        );

      case 'prep': // Dao thớt, thùng gạo, thùng rác
        if (code === 'R01') {
          // Thùng gạo thông minh (Rice Dispenser)
          return (
            <g opacity="0.85">
              <rect
                x={x + 6}
                y={y + 6}
                width={width - 12}
                height={height - 12}
                rx="4"
                fill="#431407"
                stroke="#f97316"
                strokeWidth="2"
              />
              <circle cx={x + width / 2} cy={y + 30} r="14" fill="#fb923c" />
              <rect
                x={x + 12}
                y={y + height / 2 - 12}
                width={width - 24}
                height="28"
                rx="4"
                fill="#ea580c"
                stroke="#fdba74"
                strokeWidth="1.5"
              />
            </g>
          );
        }
        if (code === 'W01') {
          // Thùng rác âm tủ (Waste Bin)
          return (
            <g opacity="0.85">
              <rect
                x={x + 6}
                y={y + 6}
                width={width - 12}
                height={height - 12}
                rx="4"
                fill="#164e63"
                stroke="#06b6d4"
                strokeWidth="2"
              />
              {/* 2 hộc chứa rác phân loại */}
              <rect
                x={x + 10}
                y={y + 14}
                width={width - 20}
                height={(height - 38) / 2}
                rx="3"
                fill="#0e7490"
                stroke="#67e8f9"
                strokeWidth="1.5"
              />
              <rect
                x={x + 10}
                y={y + 20 + (height - 38) / 2}
                width={width - 20}
                height={(height - 38) / 2}
                rx="3"
                fill="#0e7490"
                stroke="#67e8f9"
                strokeWidth="1.5"
              />
            </g>
          );
        }
        return (
          <g opacity="0.85">
            <rect
              x={x + 6}
              y={y + 6}
              width={width - 12}
              height={height - 12}
              rx="4"
              fill="#064e3b"
              stroke="#10b981"
              strokeWidth="2"
            />
            {/* Nan ray gia vị */}
            <line
              x1={x + width / 2}
              y1={y + 12}
              x2={x + width / 2}
              y2={y + height - 12}
              stroke="#34d399"
              strokeWidth="2"
            />
            <rect
              x={x + 10}
              y={y + height / 2 - 15}
              width={width - 20}
              height="30"
              rx="2"
              fill="#047857"
              stroke="#6ee7b7"
              strokeWidth="1"
            />
          </g>
        );

      case 'storage': // Tủ đồ ngăn kéo hoặc tủ đồ khô cao
        // 1. Tủ trên: Giá bát nâng hạ (UB01, UB03)
        if (code === 'UB01' || code === 'UB03') {
          return (
            <g opacity="0.9">
              {/* Vỏ thùng giá bát nâng hạ */}
              <rect
                x={x + 8}
                y={y + 8}
                width={width - 16}
                height={height - 16}
                rx="4"
                fill="#082f49"
                stroke="#0284c7"
                strokeWidth="2"
              />
              {/* Tay nâng trợ lực piston 2 bên */}
              <line x1={x + 16} y1={y + 16} x2={x + 36} y2={y + height - 20} stroke="#38bdf8" strokeWidth="3" />
              <line x1={x + width - 16} y1={y + 16} x2={x + width - 36} y2={y + height - 20} stroke="#38bdf8" strokeWidth="3" />
              {/* Nan úp đĩa inox */}
              {Array.from({ length: 6 }).map((_, i) => (
                <line
                  key={i}
                  x1={x + 50 + i * ((width - 100) / 5)}
                  y1={y + 20}
                  x2={x + 50 + i * ((width - 100) / 5)}
                  y2={y + height - 24}
                  stroke="#7dd3fc"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              ))}
              {/* Biểu tượng nâng hạ mũi tên */}
              <text
                x={x + width / 2}
                y={y + height / 2 + 6}
                textAnchor="middle"
                fill="#38bdf8"
                fontSize="24"
                fontWeight="900"
              >
                {code === 'UB03' ? '⚡ NÂNG HẠ ĐIỆN' : '⇕ NÂNG HẠ CƠ'}
              </text>
            </g>
          );
        }

        // 2. Tủ trên: Giá bát cố định (UB02)
        if (code === 'UB02') {
          return (
            <g opacity="0.9">
              <rect
                x={x + 8}
                y={y + 8}
                width={width - 16}
                height={height - 16}
                rx="4"
                fill="#172554"
                stroke="#2563eb"
                strokeWidth="2"
              />
              {/* Khay hứng nước bên dưới */}
              <rect
                x={x + 14}
                y={y + height - 24}
                width={width - 28}
                height="12"
                rx="2"
                fill="#1e3a8a"
                stroke="#60a5fa"
                strokeWidth="1.5"
              />
              {/* Nan inox 2 tầng úp bát đĩa */}
              {Array.from({ length: 7 }).map((_, i) => (
                <line
                  key={i}
                  x1={x + 30 + i * ((width - 60) / 6)}
                  y1={y + 16}
                  x2={x + 30 + i * ((width - 60) / 6)}
                  y2={y + height - 32}
                  stroke="#93c5fd"
                  strokeWidth="2"
                />
              ))}
              <text
                x={x + width / 2}
                y={y + height / 2}
                textAnchor="middle"
                fill="#60a5fa"
                fontSize="22"
                fontWeight="900"
              >
                GIÁ BÁT CỐ ĐỊNH
              </text>
            </g>
          );
        }

        // 3. Tủ trên: Giá gia vị nâng hạ (UG01, UG02)
        if (code === 'UG01' || code === 'UG02') {
          return (
            <g opacity="0.9">
              <rect
                x={x + 8}
                y={y + 8}
                width={width - 16}
                height={height - 16}
                rx="4"
                fill="#042f2e"
                stroke="#0d9488"
                strokeWidth="2"
              />
              {/* Nan chai lọ 2 tầng */}
              <rect
                x={x + 16}
                y={y + 16}
                width={width - 32}
                height={(height - 48) / 2}
                rx="3"
                fill="#115e59"
                stroke="#2dd4bf"
                strokeWidth="1.5"
              />
              <rect
                x={x + 16}
                y={y + 24 + (height - 48) / 2}
                width={width - 32}
                height={(height - 48) / 2}
                rx="3"
                fill="#115e59"
                stroke="#2dd4bf"
                strokeWidth="1.5"
              />
              <text
                x={x + width / 2}
                y={y + height / 2 + 4}
                textAnchor="middle"
                fill="#5eead4"
                fontSize="20"
                fontWeight="900"
              >
                {code === 'UG02' ? '⚡ GIA VỊ ĐIỆN' : '⇕ GIA VỊ NÂNG HẠ'}
              </text>
            </g>
          );
        }

        // 4. Tủ trên: Khoang chứa đồ tủ trên (UT01)
        if (code === 'UT01') {
          return (
            <g opacity="0.85">
              <rect
                x={x + 6}
                y={y + 6}
                width={width - 12}
                height={height - 12}
                rx="4"
                fill="#451a03"
                stroke="#d97706"
                strokeWidth="2"
              />
              {/* Đợt kệ giữa */}
              <line
                x1={x + 10}
                y1={y + height / 2}
                x2={x + width - 10}
                y2={y + height / 2}
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="6 3"
              />
              <text
                x={x + width / 2}
                y={y + 36}
                textAnchor="middle"
                fill="#fcd34d"
                fontSize="20"
                fontWeight="800"
              >
                TỦ ĐỒ TRÊN
              </text>
            </g>
          );
        }

        if (code === 'P01') {
          return (
            <g opacity="0.85">
              <rect
                x={x + 6}
                y={y + 6}
                width={width - 12}
                height={height - 12}
                rx="4"
                fill="#451a03"
                stroke="#d97706"
                strokeWidth="2.5"
              />
              {/* Ký hiệu chéo tủ kho cao tầng */}
              <line
                x1={x + 10}
                y1={y + 10}
                x2={x + width - 10}
                y2={y + height - 10}
                stroke="#fbbf24"
                strokeWidth="1.5"
                strokeDasharray="6 3"
              />
              <line
                x1={x + width - 10}
                y1={y + 10}
                x2={x + 10}
                y2={y + height - 10}
                stroke="#fbbf24"
                strokeWidth="1.5"
                strokeDasharray="6 3"
              />
            </g>
          );
        }
        return (
          <g opacity="0.85">
            <rect
              x={x + 6}
              y={y + 6}
              width={width - 12}
              height={height - 12}
              rx="4"
              fill="#451a03"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            {/* 2 đường ray ngăn kéo */}
            <line
              x1={x + 10}
              y1={y + height * 0.35}
              x2={x + width - 10}
              y2={y + height * 0.35}
              stroke="#fbbf24"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            <line
              x1={x + 10}
              y1={y + height * 0.7}
              x2={x + width - 10}
              y2={y + height * 0.7}
              stroke="#fbbf24"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            {/* Tay nắm giữa */}
            <rect
              x={x + width / 2 - 12}
              y={y + height - 14}
              width="24"
              height="4"
              rx="2"
              fill="#fde68a"
            />
          </g>
        );

      default:
        return null;
    }
  };

  return (
    <g
      className="cursor-pointer select-none"
      {...({ draggable: true } as any)}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData('application/kitchen-placed-instance', box.instanceId);
        e.dataTransfer.setData('application/kitchen-tier', placedModule.tier || 'base');
        e.dataTransfer.setData('application/kitchen-edge', box.edgeId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedInstanceId = e.dataTransfer.getData('application/kitchen-placed-instance');
        if (draggedInstanceId && draggedInstanceId !== box.instanceId) {
          onReorder?.(draggedInstanceId, box.instanceId);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(box.instanceId);
      }}
    >
      {/* Vỏ thùng module chính */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={isSelected ? '#1e293b' : '#0f172a'}
        stroke={
          isViolated
            ? '#ef4444'
            : isSelected
            ? '#38bdf8'
            : '#475569'
        }
        strokeWidth={isSelected || isViolated ? '3' : '1.5'}
        strokeDasharray={isViolated ? '6 3' : undefined}
        rx="2"
      />

      {/* Chi tiết nội thất bên trong */}
      {renderArchitecturalDetails()}

      {/* Nhãn Tên & Mã Khoang - Cỡ chữ to rõ ràng chuẩn CAD đọc rõ từ góc nhìn toàn cảnh */}
      <g className="pointer-events-none select-none">
        {/* Badge Code nổi bật */}
        <rect
          x={x + 12}
          y={y + 12}
          width={Math.min(105, width - 24)}
          height={52}
          rx="10"
          fill={isViolated ? '#dc2626' : isSelected ? '#0284c7' : '#0f172a'}
          stroke={isSelected ? '#38bdf8' : '#64748b'}
          strokeWidth="2.5"
        />
        <text
          x={x + 12 + Math.min(105, width - 24) / 2}
          y={y + 48}
          textAnchor="middle"
          fill="#ffffff"
          fontSize="36"
          fontWeight="900"
          fontFamily="monospace"
        >
          {code}
        </text>

        {/* Tên Khoang Công Năng - Cỡ chữ to lớn (50-56mm), Nền tương phản cao */}
        <g transform={`translate(${x + width / 2}, ${y + height / 2 + 10})`}>
          <rect
            x={-Math.min(width * 0.46, 210)}
            y={-38}
            width={Math.min(width * 0.92, 420)}
            height={76}
            rx="14"
            fill="#090d16"
            fillOpacity="0.94"
            stroke={isSelected ? '#38bdf8' : isViolated ? '#ef4444' : '#475569'}
            strokeWidth="2.5"
          />
          <text
            x={0}
            y={14}
            textAnchor="middle"
            fill="#ffffff"
            fontSize={width < 450 ? '38' : '48'}
            fontWeight="800"
            letterSpacing="0.5px"
          >
            {name}
          </text>
        </g>

        {/* Kích thước mm - To rõ */}
        <g transform={`translate(${x + width / 2}, ${y + height - 38})`}>
          <rect
            x={-Math.min(width * 0.42, 160)}
            y={-24}
            width={Math.min(width * 0.84, 320)}
            height={48}
            rx="10"
            fill="#090d16"
            fillOpacity="0.92"
            stroke="#334155"
            strokeWidth="1.5"
          />
          <text
            x={0}
            y={10}
            textAnchor="middle"
            fill="#38bdf8"
            fontSize="32"
            fontWeight="800"
            fontFamily="monospace"
          >
            {width} × {height} mm
          </text>
        </g>
      </g>

      {/* Hiệu ứng vi phạm (Pulsing Warning Badge) */}
      {isViolated && (
        <g transform={`translate(${x + width - 50}, ${y + 12})`}>
          <circle cx="24" cy="24" r="24" fill="#ef4444" className="animate-pulse" />
          <text
            x="24"
            y="33"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="28"
            fontWeight="bold"
          >
            !
          </text>
        </g>
      )}

      {/* Nút hành động nhanh khi được chọn (Select overlay) - Ổn định, không nhấp nháy, vùng click lớn */}
      {isSelected && (
        <g className="quick-actions" pointerEvents="auto">
          {/* Nút xóa */}
          <g
            transform={`translate(${x + width - 65}, ${y + 15})`}
            className="cursor-pointer"
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(box.instanceId);
            }}
          >
            {/* Vùng chạm mở rộng vô hình */}
            <circle cx="26" cy="26" r="38" fill="transparent" pointerEvents="all" />
            <circle
              cx="26"
              cy="26"
              r="26"
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth="2.5"
              className="hover:fill-red-600 transition-colors"
            />
            <text
              x="26"
              y="35"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="30"
              fontWeight="bold"
              className="pointer-events-none select-none"
            >
              ×
            </text>
          </g>

          {/* Nút dịch trái */}
          <g
            transform={`translate(${x + 18}, ${y + height - 68})`}
            className="cursor-pointer"
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onMoveLeft(box.instanceId);
            }}
          >
            {/* Vùng chạm mở rộng vô hình */}
            <circle cx="26" cy="26" r="38" fill="transparent" pointerEvents="all" />
            <circle
              cx="26"
              cy="26"
              r="26"
              fill="#0284c7"
              stroke="#ffffff"
              strokeWidth="2.5"
              className="hover:fill-sky-700 transition-colors"
            />
            <text
              x="26"
              y="35"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="24"
              fontWeight="bold"
              className="pointer-events-none select-none"
            >
              ◀
            </text>
          </g>

          {/* Nút dịch phải */}
          <g
            transform={`translate(${x + width - 70}, ${y + height - 68})`}
            className="cursor-pointer"
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onMoveRight(box.instanceId);
            }}
          >
            {/* Vùng chạm mở rộng vô hình */}
            <circle cx="26" cy="26" r="38" fill="transparent" pointerEvents="all" />
            <circle
              cx="26"
              cy="26"
              r="26"
              fill="#0284c7"
              stroke="#ffffff"
              strokeWidth="2.5"
              className="hover:fill-sky-700 transition-colors"
            />
            <text
              x="26"
              y="35"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="24"
              fontWeight="bold"
              className="pointer-events-none select-none"
            >
              ▶
            </text>
          </g>
        </g>
      )}
    </g>
  );
};
