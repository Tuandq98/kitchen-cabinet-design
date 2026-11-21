import { KitchenLayout, PlacedModuleInstance, EdgeId } from '../types';

export interface Module2DBox {
  instanceId: string;
  code: string;
  name: string;
  category: string;
  edgeId: EdgeId;
  x: number;
  y: number;
  width: number;
  height: number; // depth on 2D view
  rotation: number;
  centerX: number;
  centerY: number;
}

export interface CornerBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  orientation?: 'edge_A' | 'edge_B' | 'edge_C';
  tier?: 'base' | 'upper';
  deadWidth?: number;
  deadHeight?: number;
  usableWidth?: number;
  usableHeight?: number;
}

export interface UpperGapBox {
  id: string;
  edgeId: EdgeId;
  x: number;
  y: number;
  width: number;
  height: number;
  gapMm: number;
  centerX: number;
  centerY: number;
  rotation?: number;
}

export interface BaseGapBox {
  id: string;
  edgeId: EdgeId;
  x: number;
  y: number;
  width: number;
  height: number;
  gapMm: number;
  centerX: number;
  centerY: number;
  rotation?: number;
}

export interface Layout2DBounds {
  modules: Module2DBox[];
  corners: CornerBox[];
  upperModules: Module2DBox[];
  upperCorners: CornerBox[];
  upperGaps: UpperGapBox[];
  baseGaps: BaseGapBox[];
  totalWidth: number;
  totalHeight: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function createGapBox(
  edgeId: EdgeId,
  startMm: number,
  gapMm: number,
  upperDepth: number,
  is2Row: boolean,
  layout: KitchenLayout,
  idx: number
): UpperGapBox {
  const GAP = 150;
  const upperOffsetX = -(upperDepth + GAP);
  const upperOffsetCX = layout.edgeA.length + GAP;

  let x = 0;
  let y = 0;
  let width = 0;
  let height = 0;
  let rotation = 0;

  if (edgeId === 'edge_A') {
    x = startMm;
    y = 0;
    width = gapMm;
    height = upperDepth;
    rotation = 0;
  } else if (edgeId === 'edge_B') {
    x = is2Row ? upperOffsetX : 0;
    y = startMm;
    width = upperDepth;
    height = gapMm;
    rotation = 90;
  } else if (edgeId === 'edge_C') {
    x = is2Row ? upperOffsetCX : layout.edgeA.length - upperDepth;
    y = startMm;
    width = upperDepth;
    height = gapMm;
    rotation = -90;
  }

  return {
    id: `upper_gap_${edgeId}_${idx}`,
    edgeId,
    x,
    y,
    width,
    height,
    gapMm: Math.round(gapMm),
    centerX: x + width / 2,
    centerY: y + height / 2,
    rotation,
  };
}

/**
 * Tính toán danh sách các ô khoảng trống còn lại (Empty Gaps) trên hệ tủ trên
 */
export function computeUpperGaps(
  layout: KitchenLayout,
  tier: 'all' | 'base' | 'upper' = 'all'
): UpperGapBox[] {
  if (tier === 'base') return [];

  const upperDepth = layout.upperDepth || 350;
  const is2Row = tier === 'all';
  const gaps: UpperGapBox[] = [];

  const edges: { id: EdgeId; length: number }[] = [{ id: 'edge_A', length: layout.edgeA.length }];
  if ((layout.shape === 'L' || layout.shape === 'U') && layout.edgeB) {
    edges.push({ id: 'edge_B', length: layout.edgeB.length });
  }
  if (layout.shape === 'U' && layout.edgeC) {
    edges.push({ id: 'edge_C', length: layout.edgeC.length });
  }

  for (const edge of edges) {
    const edgeId = edge.id;
    const occupied: { start: number; end: number }[] = [];

    // 1. Góc chết / khoang góc tủ trên (730-780mm theo cạnh quay về, upperDepth theo cạnh đối diện)
    if (layout.shape === 'L') {
      const orientAB = layout.cornerOrientationAB || 'edge_A';
      const wUpperAB = layout.cornerWidthUpperAB || 750;
      if (edgeId === 'edge_A') {
        const occWidth = orientAB === 'edge_A' ? wUpperAB : upperDepth;
        occupied.push({ start: 0, end: occWidth });
      } else if (edgeId === 'edge_B') {
        const occWidth = orientAB === 'edge_B' ? wUpperAB : upperDepth;
        occupied.push({ start: 0, end: occWidth });
      }
    } else if (layout.shape === 'U') {
      const orientAB = layout.cornerOrientationAB || 'edge_A';
      const wUpperAB = layout.cornerWidthUpperAB || 750;
      const orientAC = layout.cornerOrientationAC || 'edge_A';
      const wUpperAC = layout.cornerWidthUpperAC || 750;
      if (edgeId === 'edge_A') {
        const occAB = orientAB === 'edge_A' ? wUpperAB : upperDepth;
        const occAC = orientAC === 'edge_A' ? wUpperAC : upperDepth;
        occupied.push({ start: 0, end: occAB });
        occupied.push({ start: edge.length - occAC, end: edge.length });
      } else if (edgeId === 'edge_B') {
        const occAB = orientAB === 'edge_B' ? wUpperAB : upperDepth;
        occupied.push({ start: 0, end: occAB });
      } else if (edgeId === 'edge_C') {
        const occAC = orientAC === 'edge_C' ? wUpperAC : upperDepth;
        occupied.push({ start: 0, end: occAC });
      }
    }

    // 2. Vùng tủ cao (F01, P01, A01...)
    const tallUnits = layout.placedModules.filter(
      (m) =>
        m.edgeId === edgeId &&
        (m.code === 'F01' ||
          m.code === 'P01' ||
          m.code === 'A01' ||
          m.category === 'refrigeration')
    );
    for (const t of tallUnits) {
      occupied.push({ start: t.offset, end: t.offset + t.width });
    }

    occupied.sort((a, b) => a.start - b.start);

    // Hợp nhất occupied chồng lấn
    const mergedOccupied: { start: number; end: number }[] = [];
    for (const occ of occupied) {
      if (mergedOccupied.length === 0) {
        mergedOccupied.push({ ...occ });
      } else {
        const last = mergedOccupied[mergedOccupied.length - 1];
        if (occ.start <= last.end) {
          last.end = Math.max(last.end, occ.end);
        } else {
          mergedOccupied.push({ ...occ });
        }
      }
    }

    // Xác định các openIntervals
    const openIntervals: { start: number; end: number }[] = [];
    let curX = 0;
    for (const occ of mergedOccupied) {
      if (occ.start > curX) {
        openIntervals.push({ start: curX, end: occ.start });
      }
      curX = Math.max(curX, occ.end);
    }
    if (curX < edge.length) {
      openIntervals.push({ start: curX, end: edge.length });
    }

    // Lấy các khoang tủ trên hiện có trên cạnh này
    const upperOnEdge = (layout.placedUpperModules || [])
      .filter((m) => m.edgeId === edgeId)
      .sort((a, b) => a.offset - b.offset);

    let gapIndex = 0;
    for (const interval of openIntervals) {
      const modsInInterval = upperOnEdge.filter(
        (m) => m.offset + m.width > interval.start && m.offset < interval.end
      );

      let ptr = interval.start;
      for (const m of modsInInterval) {
        if (m.offset > ptr + 5) {
          const gapMm = m.offset - ptr;
          if (gapMm >= 10) {
            gaps.push(createGapBox(edgeId, ptr, gapMm, upperDepth, is2Row, layout, gapIndex++));
          }
        }
        ptr = Math.max(ptr, m.offset + m.width);
      }

      if (interval.end > ptr + 5) {
        const gapMm = interval.end - ptr;
        if (gapMm >= 10) {
          gaps.push(createGapBox(edgeId, ptr, gapMm, upperDepth, is2Row, layout, gapIndex++));
        }
      }
    }
  }

  return gaps;
}

/**
 * Tính toán danh sách các ô khoảng trống còn lại (Empty Gaps) trên hệ tủ dưới
 */
export function computeBaseGaps(
  layout: KitchenLayout,
  tier: 'all' | 'base' | 'upper' = 'all'
): BaseGapBox[] {
  if (tier === 'upper') return [];

  const depthA = layout.edgeA.depth || 600;
  const depthB = layout.edgeB?.depth || 600;
  const depthC = layout.edgeC?.depth || 600;
  const upperDepth = layout.upperDepth || 350;
  const GAP = 150;
  const is2Row = tier === 'all';
  const baseRowY = is2Row ? upperDepth + GAP : 0;

  const gaps: BaseGapBox[] = [];
  let gapIdx = 0;

  if (layout.shape === 'I') {
    const lengthA = layout.edgeA.length;
    const modulesA = layout.placedModules
      .filter((m) => m.edgeId === 'edge_A')
      .sort((a, b) => a.offset - b.offset);

    let ptr = 0;
    for (const m of modulesA) {
      if (m.offset > ptr + 5) {
        const gapMm = m.offset - ptr;
        if (gapMm >= 10) {
          gaps.push({
            id: `base_gap_edge_A_${gapIdx++}`,
            edgeId: 'edge_A',
            x: ptr,
            y: baseRowY,
            width: gapMm,
            height: depthA,
            gapMm: Math.round(gapMm),
            centerX: ptr + gapMm / 2,
            centerY: baseRowY + depthA / 2,
            rotation: 0,
          });
        }
      }
      ptr = Math.max(ptr, m.offset + m.width);
    }
    if (lengthA > ptr + 5) {
      const gapMm = lengthA - ptr;
      if (gapMm >= 10) {
        gaps.push({
          id: `base_gap_edge_A_${gapIdx++}`,
          edgeId: 'edge_A',
          x: ptr,
          y: baseRowY,
          width: gapMm,
          height: depthA,
          gapMm: Math.round(gapMm),
          centerX: ptr + gapMm / 2,
          centerY: baseRowY + depthA / 2,
          rotation: 0,
        });
      }
    }
  } else if (layout.shape === 'L') {
    const lengthA = layout.edgeA.length;
    const lengthB = layout.edgeB ? layout.edgeB.length : 2400;
    const orientAB = layout.cornerOrientationAB || 'edge_A';
    const wBaseAB = layout.cornerWidthBaseAB || 1000;

    // Cạnh A: bắt đầu sau góc (wBaseAB nếu quay về A, depthB nếu quay về B)
    const ptrA_start = orientAB === 'edge_A' ? wBaseAB : depthB;
    const modulesA = layout.placedModules
      .filter((m) => m.edgeId === 'edge_A')
      .sort((a, b) => a.offset - b.offset);

    let ptrA = ptrA_start;
    for (const m of modulesA) {
      if (m.offset > ptrA + 5) {
        const gapMm = m.offset - ptrA;
        if (gapMm >= 10) {
          gaps.push({
            id: `base_gap_edge_A_${gapIdx++}`,
            edgeId: 'edge_A',
            x: ptrA,
            y: baseRowY,
            width: gapMm,
            height: depthA,
            gapMm: Math.round(gapMm),
            centerX: ptrA + gapMm / 2,
            centerY: baseRowY + depthA / 2,
            rotation: 0,
          });
        }
      }
      ptrA = Math.max(ptrA, m.offset + m.width);
    }
    if (lengthA > ptrA + 5) {
      const gapMm = lengthA - ptrA;
      if (gapMm >= 10) {
        gaps.push({
          id: `base_gap_edge_A_${gapIdx++}`,
          edgeId: 'edge_A',
          x: ptrA,
          y: baseRowY,
          width: gapMm,
          height: depthA,
          gapMm: Math.round(gapMm),
          centerX: ptrA + gapMm / 2,
          centerY: baseRowY + depthA / 2,
          rotation: 0,
        });
      }
    }

    // Cạnh B: bắt đầu sau góc (wBaseAB nếu quay về B, depthA nếu quay về A)
    const ptrB_start = orientAB === 'edge_B' ? wBaseAB : depthA;
    const modulesB = layout.placedModules
      .filter((m) => m.edgeId === 'edge_B')
      .sort((a, b) => a.offset - b.offset);

    let ptrB = ptrB_start;
    for (const m of modulesB) {
      if (m.offset > ptrB + 5) {
        const gapMm = m.offset - ptrB;
        if (gapMm >= 10) {
          gaps.push({
            id: `base_gap_edge_B_${gapIdx++}`,
            edgeId: 'edge_B',
            x: 0,
            y: baseRowY + ptrB,
            width: depthB,
            height: gapMm,
            gapMm: Math.round(gapMm),
            centerX: depthB / 2,
            centerY: baseRowY + ptrB + gapMm / 2,
            rotation: 90,
          });
        }
      }
      ptrB = Math.max(ptrB, m.offset + m.width);
    }
    if (lengthB > ptrB + 5) {
      const gapMm = lengthB - ptrB;
      if (gapMm >= 10) {
        gaps.push({
          id: `base_gap_edge_B_${gapIdx++}`,
          edgeId: 'edge_B',
          x: 0,
          y: baseRowY + ptrB,
          width: depthB,
          height: gapMm,
          gapMm: Math.round(gapMm),
          centerX: depthB / 2,
          centerY: baseRowY + ptrB + gapMm / 2,
          rotation: 90,
        });
      }
    }
  } else if (layout.shape === 'U') {
    const lengthA = layout.edgeA.length;
    const lengthB = layout.edgeB ? layout.edgeB.length : 2400;
    const lengthC = layout.edgeC ? layout.edgeC.length : 2400;
    const orientAB = layout.cornerOrientationAB || 'edge_A';
    const wBaseAB = layout.cornerWidthBaseAB || 1000;
    const orientAC = layout.cornerOrientationAC || 'edge_A';
    const wBaseAC = layout.cornerWidthBaseAC || 1000;

    const takesAB_on_A = orientAB === 'edge_A' ? wBaseAB : depthB;
    const takesAC_on_A = orientAC === 'edge_A' ? wBaseAC : depthC;
    const takesAB_on_B = orientAB === 'edge_B' ? wBaseAB : depthA;
    const takesAC_on_C = orientAC === 'edge_C' ? wBaseAC : depthA;

    // Cạnh B (trái)
    const modulesB = layout.placedModules
      .filter((m) => m.edgeId === 'edge_B')
      .sort((a, b) => a.offset - b.offset);

    let ptrB = takesAB_on_B;
    for (const m of modulesB) {
      if (m.offset > ptrB + 5) {
        const gapMm = m.offset - ptrB;
        if (gapMm >= 10) {
          gaps.push({
            id: `base_gap_edge_B_${gapIdx++}`,
            edgeId: 'edge_B',
            x: 0,
            y: baseRowY + ptrB,
            width: depthB,
            height: gapMm,
            gapMm: Math.round(gapMm),
            centerX: depthB / 2,
            centerY: baseRowY + ptrB + gapMm / 2,
            rotation: 90,
          });
        }
      }
      ptrB = Math.max(ptrB, m.offset + m.width);
    }
    if (lengthB > ptrB + 5) {
      const gapMm = lengthB - ptrB;
      if (gapMm >= 10) {
        gaps.push({
          id: `base_gap_edge_B_${gapIdx++}`,
          edgeId: 'edge_B',
          x: 0,
          y: baseRowY + ptrB,
          width: depthB,
          height: gapMm,
          gapMm: Math.round(gapMm),
          centerX: depthB / 2,
          centerY: baseRowY + ptrB + gapMm / 2,
          rotation: 90,
        });
      }
    }

    // Cạnh A (giữa)
    const endA = lengthA - takesAC_on_A;
    const modulesA = layout.placedModules
      .filter((m) => m.edgeId === 'edge_A')
      .sort((a, b) => a.offset - b.offset);

    let ptrA = takesAB_on_A;
    for (const m of modulesA) {
      if (m.offset > ptrA + 5) {
        const gapMm = m.offset - ptrA;
        if (gapMm >= 10) {
          gaps.push({
            id: `base_gap_edge_A_${gapIdx++}`,
            edgeId: 'edge_A',
            x: ptrA,
            y: baseRowY,
            width: gapMm,
            height: depthA,
            gapMm: Math.round(gapMm),
            centerX: ptrA + gapMm / 2,
            centerY: baseRowY + depthA / 2,
            rotation: 0,
          });
        }
      }
      ptrA = Math.max(ptrA, m.offset + m.width);
    }
    if (endA > ptrA + 5) {
      const gapMm = endA - ptrA;
      if (gapMm >= 10) {
        gaps.push({
          id: `base_gap_edge_A_${gapIdx++}`,
          edgeId: 'edge_A',
          x: ptrA,
          y: baseRowY,
          width: gapMm,
          height: depthA,
          gapMm: Math.round(gapMm),
          centerX: ptrA + gapMm / 2,
          centerY: baseRowY + depthA / 2,
          rotation: 0,
        });
      }
    }

    // Cạnh C (phải)
    const modulesC = layout.placedModules
      .filter((m) => m.edgeId === 'edge_C')
      .sort((a, b) => a.offset - b.offset);

    let ptrC = takesAC_on_C;
    for (const m of modulesC) {
      if (m.offset > ptrC + 5) {
        const gapMm = m.offset - ptrC;
        if (gapMm >= 10) {
          gaps.push({
            id: `base_gap_edge_C_${gapIdx++}`,
            edgeId: 'edge_C',
            x: lengthA - depthC,
            y: baseRowY + ptrC,
            width: depthC,
            height: gapMm,
            gapMm: Math.round(gapMm),
            centerX: lengthA - depthC / 2,
            centerY: baseRowY + ptrC + gapMm / 2,
            rotation: -90,
          });
        }
      }
      ptrC = Math.max(ptrC, m.offset + m.width);
    }
    if (lengthC > ptrC + 5) {
      const gapMm = lengthC - ptrC;
      if (gapMm >= 10) {
        gaps.push({
          id: `base_gap_edge_C_${gapIdx++}`,
          edgeId: 'edge_C',
          x: lengthA - depthC,
          y: baseRowY + ptrC,
          width: depthC,
          height: gapMm,
          gapMm: Math.round(gapMm),
          centerX: lengthA - depthC / 2,
          centerY: baseRowY + ptrC + gapMm / 2,
          rotation: -90,
        });
      }
    }
  }

  return gaps;
}

/**
 * Tính toán tọa độ 2D (CAD Floor Plan) cho tất cả các khoang và góc nối
 * Chuẩn kiến trúc:
 * - Bếp chữ I: 1 cạnh ngang (Cạnh A)
 * - Bếp chữ L: Cạnh A nằm ngang ở trên, Cạnh B nối vuông góc đi xuống ở bên trái (Corner tại [0,0])
 * - Bếp chữ U: Cạnh A nằm ngang ở giữa/trên, Cạnh B bên trái đi xuống, Cạnh C bên phải đi xuống
 */
export function calculateLayout2D(
  layout: KitchenLayout,
  tier: 'all' | 'base' | 'upper' = 'all'
): Layout2DBounds {
  const depthA = layout.edgeA.depth || 600;
  const depthB = layout.edgeB?.depth || 600;
  const depthC = layout.edgeC?.depth || 600;
  const upperDepth = layout.upperDepth || 350;
  const GAP = 150; // Khoảng cách giãn giữa dòng tủ trên và dòng tủ dưới (mm)
  const is2Row = tier === 'all';

  const modules2D: Module2DBox[] = [];
  const corners: CornerBox[] = [];
  const upperModules2D: Module2DBox[] = [];
  const upperCorners: CornerBox[] = [];

  if (layout.shape === 'I') {
    // Bếp chữ I:
    // Khi hiển thị cả 2 tầng (tier === 'all'):
    // - Dòng 1 (Tủ trên): Y = 0 đến upperDepth (350mm)
    // - Khoảng hở: Y = 350 đến 500mm (GAP = 150mm)
    // - Dòng 2 (Tủ dưới): Y = 500 đến 1100mm (depthA = 600mm)
    const lengthA = layout.edgeA.length;
    const baseRowY = is2Row ? upperDepth + GAP : 0;

    let currentX = 0;
    const modulesA = layout.placedModules
      .filter((m) => m.edgeId === 'edge_A')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    for (const m of modulesA) {
      const x = m.offset !== undefined ? m.offset : currentX;
      const y = baseRowY;
      const w = m.width;
      const h = depthA;

      modules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_A',
        x,
        y,
        width: w,
        height: h,
        rotation: 0,
        centerX: x + w / 2,
        centerY: y + h / 2,
      });

      currentX = x + w;
    }

    // Tủ trên Cạnh A (chữ I)
    const upperModulesA = (layout.placedUpperModules || [])
      .filter((m) => m.edgeId === 'edge_A')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let currentUpperX = 0;
    for (const m of upperModulesA) {
      const x = m.offset !== undefined ? m.offset : currentUpperX;
      const y = 0;
      const w = m.width;
      const h = upperDepth;

      upperModules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_A',
        x,
        y,
        width: w,
        height: h,
        rotation: 0,
        centerX: x + w / 2,
        centerY: y + h / 2,
      });

      currentUpperX = x + w;
    }

    const totalHeight = is2Row ? baseRowY + depthA : tier === 'upper' ? upperDepth : depthA;

    return {
      modules: modules2D,
      corners: [],
      upperModules: upperModules2D,
      upperCorners: [],
      upperGaps: computeUpperGaps(layout, tier),
      baseGaps: computeBaseGaps(layout, tier),
      totalWidth: lengthA,
      totalHeight,
      minX: 0,
      minY: 0,
      maxX: lengthA,
      maxY: totalHeight,
    };
  }

  if (layout.shape === 'L') {
    // Bếp chữ L:
    const lengthA = layout.edgeA.length;
    const lengthB = layout.edgeB ? layout.edgeB.length : 2400;
    const orientAB = layout.cornerOrientationAB || 'edge_A';
    const wBaseAB = layout.cornerWidthBaseAB || 1000;
    const wUpperAB = layout.cornerWidthUpperAB || 750;

    if (is2Row) {
      // 2 Dòng song song tách biệt:
      // Tủ trên ở trên/ngoài: Cạnh A Y=0..350, Cạnh B X=-500..-150
      // Tủ dưới ở dưới/trong: Cạnh A Y=500..1100, Cạnh B X=0..600
      const baseRowY = upperDepth + GAP; // 500
      const upperOffsetX = -(upperDepth + GAP); // -500

      if (orientAB === 'edge_A') {
        corners.push({
          id: 'corner_AB',
          x: 0,
          y: baseRowY,
          width: wBaseAB,
          height: depthA,
          label: `Góc nối AB (${wBaseAB}x${depthA}) - Quay Cạnh A`,
          orientation: 'edge_A',
          tier: 'base',
          deadWidth: depthB,
          deadHeight: depthA,
          usableWidth: wBaseAB - depthB,
          usableHeight: depthA,
        });

        upperCorners.push({
          id: 'upper_corner_AB',
          x: upperOffsetX,
          y: 0,
          width: wUpperAB,
          height: upperDepth,
          label: `Góc tủ trên (${wUpperAB}x${upperDepth}) - Quay Cạnh A`,
          orientation: 'edge_A',
          tier: 'upper',
          deadWidth: upperDepth,
          deadHeight: upperDepth,
          usableWidth: wUpperAB - upperDepth,
          usableHeight: upperDepth,
        });
      } else {
        corners.push({
          id: 'corner_AB',
          x: 0,
          y: baseRowY,
          width: depthB,
          height: wBaseAB,
          label: `Góc nối AB (${depthB}x${wBaseAB}) - Quay Cạnh B`,
          orientation: 'edge_B',
          tier: 'base',
          deadWidth: depthB,
          deadHeight: depthA,
          usableWidth: depthB,
          usableHeight: wBaseAB - depthA,
        });

        upperCorners.push({
          id: 'upper_corner_AB',
          x: upperOffsetX,
          y: 0,
          width: upperDepth,
          height: wUpperAB,
          label: `Góc tủ trên (${upperDepth}x${wUpperAB}) - Quay Cạnh B`,
          orientation: 'edge_B',
          tier: 'upper',
          deadWidth: upperDepth,
          deadHeight: upperDepth,
          usableWidth: upperDepth,
          usableHeight: wUpperAB - upperDepth,
        });
      }

      // Modules cạnh A tủ dưới (chạy ngang sang phải từ điểm kết thúc góc)
      const modulesA = layout.placedModules
        .filter((m) => m.edgeId === 'edge_A')
        .sort((a, b) => a.positionIndex - b.positionIndex);

      let currentX = orientAB === 'edge_A' ? wBaseAB : depthB;
      for (const m of modulesA) {
        const x = m.offset !== undefined ? m.offset : currentX;
        const y = baseRowY;
        const w = m.width;
        const h = depthA;

        modules2D.push({
          instanceId: m.instanceId,
          code: m.code,
          name: m.name,
          category: m.category,
          edgeId: 'edge_A',
          x,
          y,
          width: w,
          height: h,
          rotation: 0,
          centerX: x + w / 2,
          centerY: y + h / 2,
        });

        currentX = x + w;
      }

      // Modules cạnh B tủ dưới (chạy dọc xuống dưới từ điểm kết thúc góc)
      const modulesB = layout.placedModules
        .filter((m) => m.edgeId === 'edge_B')
        .sort((a, b) => a.positionIndex - b.positionIndex);

      let currentY = baseRowY + (orientAB === 'edge_B' ? wBaseAB : depthA);
      for (const m of modulesB) {
        const x = 0;
        const y = m.offset !== undefined ? baseRowY + m.offset : currentY;
        const w = depthB;
        const h = m.width;

        modules2D.push({
          instanceId: m.instanceId,
          code: m.code,
          name: m.name,
          category: m.category,
          edgeId: 'edge_B',
          x,
          y,
          width: w,
          height: h,
          rotation: 90,
          centerX: x + w / 2,
          centerY: y + h / 2,
        });

        currentY = y + m.width;
      }

      // Tủ trên Cạnh A (L)
      const upperModulesA = (layout.placedUpperModules || [])
        .filter((m) => m.edgeId === 'edge_A')
        .sort((a, b) => a.positionIndex - b.positionIndex);

      let currentUpperXA = orientAB === 'edge_A' ? wUpperAB : upperDepth;
      for (const m of upperModulesA) {
        const x = m.offset !== undefined ? m.offset : currentUpperXA;
        const y = 0;
        const w = m.width;
        const h = upperDepth;

        upperModules2D.push({
          instanceId: m.instanceId,
          code: m.code,
          name: m.name,
          category: m.category,
          edgeId: 'edge_A',
          x,
          y,
          width: w,
          height: h,
          rotation: 0,
          centerX: x + w / 2,
          centerY: y + h / 2,
        });

        currentUpperXA = x + w;
      }

      // Tủ trên Cạnh B (L)
      const upperModulesB = (layout.placedUpperModules || [])
        .filter((m) => m.edgeId === 'edge_B')
        .sort((a, b) => a.positionIndex - b.positionIndex);

      let currentUpperYB = orientAB === 'edge_B' ? wUpperAB : upperDepth;
      for (const m of upperModulesB) {
        const x = upperOffsetX;
        const y = m.offset !== undefined ? m.offset : currentUpperYB;
        const w = upperDepth;
        const h = m.width;

        upperModules2D.push({
          instanceId: m.instanceId,
          code: m.code,
          name: m.name,
          category: m.category,
          edgeId: 'edge_B',
          x,
          y,
          width: w,
          height: h,
          rotation: 90,
          centerX: x + w / 2,
          centerY: y + h / 2,
        });

        currentUpperYB = y + m.width;
      }

      return {
        modules: modules2D,
        corners,
        upperModules: upperModules2D,
        upperCorners,
        upperGaps: computeUpperGaps(layout, tier),
        baseGaps: computeBaseGaps(layout, tier),
        totalWidth: lengthA + Math.abs(upperOffsetX),
        totalHeight: Math.max(lengthB + baseRowY, lengthB),
        minX: upperOffsetX,
        minY: 0,
        maxX: lengthA,
        maxY: lengthB + baseRowY,
      };
    } else {
      // Đơn tầng (Chỉ Tủ Dưới hoặc Chỉ Tủ Trên)
      const isUpper = tier === 'upper';
      const curDepthA = isUpper ? upperDepth : depthA;
      const curDepthB = isUpper ? upperDepth : depthB;

      if (!isUpper) {
        if (orientAB === 'edge_A') {
          corners.push({
            id: 'corner_AB',
            x: 0,
            y: 0,
            width: wBaseAB,
            height: depthA,
            label: `Góc nối AB (${wBaseAB}x${depthA}) - Quay Cạnh A`,
            orientation: 'edge_A',
            tier: 'base',
            deadWidth: depthB,
            deadHeight: depthA,
            usableWidth: wBaseAB - depthB,
            usableHeight: depthA,
          });
        } else {
          corners.push({
            id: 'corner_AB',
            x: 0,
            y: 0,
            width: depthB,
            height: wBaseAB,
            label: `Góc nối AB (${depthB}x${wBaseAB}) - Quay Cạnh B`,
            orientation: 'edge_B',
            tier: 'base',
            deadWidth: depthB,
            deadHeight: depthA,
            usableWidth: depthB,
            usableHeight: wBaseAB - depthA,
          });
        }
      } else {
        if (orientAB === 'edge_A') {
          upperCorners.push({
            id: 'upper_corner_AB',
            x: 0,
            y: 0,
            width: wUpperAB,
            height: upperDepth,
            label: `Góc tủ trên (${wUpperAB}x${upperDepth}) - Quay Cạnh A`,
            orientation: 'edge_A',
            tier: 'upper',
            deadWidth: upperDepth,
            deadHeight: upperDepth,
            usableWidth: wUpperAB - upperDepth,
            usableHeight: upperDepth,
          });
        } else {
          upperCorners.push({
            id: 'upper_corner_AB',
            x: 0,
            y: 0,
            width: upperDepth,
            height: wUpperAB,
            label: `Góc tủ trên (${upperDepth}x${wUpperAB}) - Quay Cạnh B`,
            orientation: 'edge_B',
            tier: 'upper',
            deadWidth: upperDepth,
            deadHeight: upperDepth,
            usableWidth: upperDepth,
            usableHeight: wUpperAB - upperDepth,
          });
        }
      }

      const modulesA = layout.placedModules
        .filter((m) => m.edgeId === 'edge_A')
        .sort((a, b) => a.positionIndex - b.positionIndex);

      let currentX = orientAB === 'edge_A' ? wBaseAB : curDepthB;
      for (const m of modulesA) {
        const x = m.offset !== undefined ? m.offset : currentX;
        const y = 0;
        const w = m.width;
        const h = curDepthA;

        modules2D.push({
          instanceId: m.instanceId,
          code: m.code,
          name: m.name,
          category: m.category,
          edgeId: 'edge_A',
          x,
          y,
          width: w,
          height: h,
          rotation: 0,
          centerX: x + w / 2,
          centerY: y + h / 2,
        });
        currentX = x + w;
      }

      const modulesB = layout.placedModules
        .filter((m) => m.edgeId === 'edge_B')
        .sort((a, b) => a.positionIndex - b.positionIndex);

      let currentY = orientAB === 'edge_B' ? wBaseAB : curDepthA;
      for (const m of modulesB) {
        const x = 0;
        const y = m.offset !== undefined ? m.offset : currentY;
        const w = curDepthB;
        const h = m.width;

        modules2D.push({
          instanceId: m.instanceId,
          code: m.code,
          name: m.name,
          category: m.category,
          edgeId: 'edge_B',
          x,
          y,
          width: w,
          height: h,
          rotation: 90,
          centerX: x + w / 2,
          centerY: y + h / 2,
        });
        currentY = y + m.width;
      }

      const upperModulesA = (layout.placedUpperModules || [])
        .filter((m) => m.edgeId === 'edge_A')
        .sort((a, b) => a.positionIndex - b.positionIndex);

      let currentUpperXA = orientAB === 'edge_A' ? wUpperAB : upperDepth;
      for (const m of upperModulesA) {
        const x = m.offset !== undefined ? m.offset : currentUpperXA;
        const y = 0;
        const w = m.width;
        const h = upperDepth;

        upperModules2D.push({
          instanceId: m.instanceId,
          code: m.code,
          name: m.name,
          category: m.category,
          edgeId: 'edge_A',
          x,
          y,
          width: w,
          height: h,
          rotation: 0,
          centerX: x + w / 2,
          centerY: y + h / 2,
        });
        currentUpperXA = x + w;
      }

      const upperModulesB = (layout.placedUpperModules || [])
        .filter((m) => m.edgeId === 'edge_B')
        .sort((a, b) => a.positionIndex - b.positionIndex);

      let currentUpperYB = orientAB === 'edge_B' ? wUpperAB : upperDepth;
      for (const m of upperModulesB) {
        const x = 0;
        const y = m.offset !== undefined ? m.offset : currentUpperYB;
        const w = upperDepth;
        const h = m.width;

        upperModules2D.push({
          instanceId: m.instanceId,
          code: m.code,
          name: m.name,
          category: m.category,
          edgeId: 'edge_B',
          x,
          y,
          width: w,
          height: h,
          rotation: 90,
          centerX: x + w / 2,
          centerY: y + h / 2,
        });
        currentUpperYB = y + m.width;
      }

      return {
        modules: modules2D,
        corners,
        upperModules: upperModules2D,
        upperCorners,
        upperGaps: computeUpperGaps(layout, tier),
        baseGaps: computeBaseGaps(layout, tier),
        totalWidth: lengthA,
        totalHeight: lengthB,
        minX: 0,
        minY: 0,
        maxX: lengthA,
        maxY: lengthB,
      };
    }
  }

  // Bếp chữ U:
  const lengthA = layout.edgeA.length;
  const lengthB = layout.edgeB ? layout.edgeB.length : 2400;
  const lengthC = layout.edgeC ? layout.edgeC.length : 2400;
  const orientAB = layout.cornerOrientationAB || 'edge_A';
  const wBaseAB = layout.cornerWidthBaseAB || 1000;
  const wUpperAB = layout.cornerWidthUpperAB || 750;
  const orientAC = layout.cornerOrientationAC || 'edge_A';
  const wBaseAC = layout.cornerWidthBaseAC || 1000;
  const wUpperAC = layout.cornerWidthUpperAC || 750;

  if (is2Row) {
    const baseRowY = upperDepth + GAP; // 500
    const upperOffsetX = -(upperDepth + GAP); // -500
    const upperOffsetCX = lengthA + GAP;

    // Corner AB
    if (orientAB === 'edge_A') {
      corners.push({
        id: 'corner_AB',
        x: 0,
        y: baseRowY,
        width: wBaseAB,
        height: depthA,
        label: `Góc AB (${wBaseAB}x${depthA}) - Quay Cạnh A`,
        orientation: 'edge_A',
        tier: 'base',
        deadWidth: depthB,
        deadHeight: depthA,
        usableWidth: wBaseAB - depthB,
        usableHeight: depthA,
      });

      upperCorners.push({
        id: 'upper_corner_AB',
        x: upperOffsetX,
        y: 0,
        width: wUpperAB,
        height: upperDepth,
        label: `Góc tủ trên AB - Quay Cạnh A`,
        orientation: 'edge_A',
        tier: 'upper',
        deadWidth: upperDepth,
        deadHeight: upperDepth,
        usableWidth: wUpperAB - upperDepth,
        usableHeight: upperDepth,
      });
    } else {
      corners.push({
        id: 'corner_AB',
        x: 0,
        y: baseRowY,
        width: depthB,
        height: wBaseAB,
        label: `Góc AB (${depthB}x${wBaseAB}) - Quay Cạnh B`,
        orientation: 'edge_B',
        tier: 'base',
        deadWidth: depthB,
        deadHeight: depthA,
        usableWidth: depthB,
        usableHeight: wBaseAB - depthA,
      });

      upperCorners.push({
        id: 'upper_corner_AB',
        x: upperOffsetX,
        y: 0,
        width: upperDepth,
        height: wUpperAB,
        label: `Góc tủ trên AB - Quay Cạnh B`,
        orientation: 'edge_B',
        tier: 'upper',
        deadWidth: upperDepth,
        deadHeight: upperDepth,
        usableWidth: upperDepth,
        usableHeight: wUpperAB - upperDepth,
      });
    }

    // Corner AC
    if (orientAC === 'edge_A') {
      corners.push({
        id: 'corner_AC',
        x: lengthA - wBaseAC,
        y: baseRowY,
        width: wBaseAC,
        height: depthA,
        label: `Góc AC (${wBaseAC}x${depthA}) - Quay Cạnh A`,
        orientation: 'edge_A',
        tier: 'base',
        deadWidth: depthC,
        deadHeight: depthA,
        usableWidth: wBaseAC - depthC,
        usableHeight: depthA,
      });

      upperCorners.push({
        id: 'upper_corner_AC',
        x: upperOffsetCX,
        y: 0,
        width: wUpperAC,
        height: upperDepth,
        label: `Góc tủ trên AC - Quay Cạnh A`,
        orientation: 'edge_A',
        tier: 'upper',
        deadWidth: upperDepth,
        deadHeight: upperDepth,
        usableWidth: wUpperAC - upperDepth,
        usableHeight: upperDepth,
      });
    } else {
      corners.push({
        id: 'corner_AC',
        x: lengthA - depthC,
        y: baseRowY,
        width: depthC,
        height: wBaseAC,
        label: `Góc AC (${depthC}x${wBaseAC}) - Quay Cạnh C`,
        orientation: 'edge_C',
        tier: 'base',
        deadWidth: depthC,
        deadHeight: depthA,
        usableWidth: depthC,
        usableHeight: wBaseAC - depthA,
      });

      upperCorners.push({
        id: 'upper_corner_AC',
        x: upperOffsetCX,
        y: 0,
        width: upperDepth,
        height: wUpperAC,
        label: `Góc tủ trên AC - Quay Cạnh C`,
        orientation: 'edge_C',
        tier: 'upper',
        deadWidth: upperDepth,
        deadHeight: upperDepth,
        usableWidth: upperDepth,
        usableHeight: wUpperAC - upperDepth,
      });
    }

    // Modules Cạnh B (bên trái)
    const modulesB = layout.placedModules
      .filter((m) => m.edgeId === 'edge_B')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let currentYB = baseRowY + (orientAB === 'edge_B' ? wBaseAB : depthA);
    for (const m of modulesB) {
      const y = m.offset !== undefined ? baseRowY + m.offset : currentYB;
      modules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_B',
        x: 0,
        y,
        width: depthB,
        height: m.width,
        rotation: 90,
        centerX: depthB / 2,
        centerY: y + m.width / 2,
      });
      currentYB += m.width;
    }

    // Modules Cạnh A (ở giữa)
    const modulesA = layout.placedModules
      .filter((m) => m.edgeId === 'edge_A')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let currentXA = orientAB === 'edge_A' ? wBaseAB : depthB;
    for (const m of modulesA) {
      const x = m.offset !== undefined ? m.offset : currentXA;
      modules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_A',
        x,
        y: baseRowY,
        width: m.width,
        height: depthA,
        rotation: 0,
        centerX: x + m.width / 2,
        centerY: baseRowY + depthA / 2,
      });
      currentXA += m.width;
    }

    // Modules Cạnh C (bên phải)
    const modulesC = layout.placedModules
      .filter((m) => m.edgeId === 'edge_C')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let currentYC = baseRowY + (orientAC === 'edge_C' ? wBaseAC : depthA);
    for (const m of modulesC) {
      const y = m.offset !== undefined ? baseRowY + m.offset : currentYC;
      modules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_C',
        x: lengthA - depthC,
        y,
        width: depthC,
        height: m.width,
        rotation: -90,
        centerX: lengthA - depthC / 2,
        centerY: y + m.width / 2,
      });
      currentYC += m.width;
    }

    // Tủ trên U: Cạnh B, A, C
    const upperModulesB = (layout.placedUpperModules || [])
      .filter((m) => m.edgeId === 'edge_B')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let curUpperYB = orientAB === 'edge_B' ? wUpperAB : upperDepth;
    for (const m of upperModulesB) {
      const y = m.offset !== undefined ? m.offset : curUpperYB;
      upperModules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_B',
        x: upperOffsetX,
        y,
        width: upperDepth,
        height: m.width,
        rotation: 90,
        centerX: upperOffsetX + upperDepth / 2,
        centerY: y + m.width / 2,
      });
      curUpperYB = y + m.width;
    }

    const upperModulesA = (layout.placedUpperModules || [])
      .filter((m) => m.edgeId === 'edge_A')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let curUpperXA = orientAB === 'edge_A' ? wUpperAB : upperDepth;
    for (const m of upperModulesA) {
      const x = m.offset !== undefined ? m.offset : curUpperXA;
      upperModules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_A',
        x,
        y: 0,
        width: m.width,
        height: upperDepth,
        rotation: 0,
        centerX: x + m.width / 2,
        centerY: upperDepth / 2,
      });
      curUpperXA = x + m.width;
    }

    const upperModulesC = (layout.placedUpperModules || [])
      .filter((m) => m.edgeId === 'edge_C')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let curUpperYC = orientAC === 'edge_C' ? wUpperAC : upperDepth;
    for (const m of upperModulesC) {
      const y = m.offset !== undefined ? m.offset : curUpperYC;
      upperModules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_C',
        x: upperOffsetCX,
        y,
        width: upperDepth,
        height: m.width,
        rotation: -90,
        centerX: upperOffsetCX + upperDepth / 2,
        centerY: y + m.width / 2,
      });
      curUpperYC = y + m.width;
    }

    return {
      modules: modules2D,
      corners,
      upperModules: upperModules2D,
      upperCorners,
      upperGaps: computeUpperGaps(layout, tier),
      baseGaps: computeBaseGaps(layout, tier),
      totalWidth: lengthA + Math.abs(upperOffsetX) + GAP + upperDepth,
      totalHeight: Math.max(lengthB, lengthC) + baseRowY,
      minX: upperOffsetX,
      minY: 0,
      maxX: lengthA + GAP + upperDepth,
      maxY: Math.max(lengthB, lengthC) + baseRowY,
    };
  } else {
    // Đơn tầng Chữ U
    const isUpper = tier === 'upper';
    const curDepthA = isUpper ? upperDepth : depthA;
    const curDepthB = isUpper ? upperDepth : depthB;
    const curDepthC = isUpper ? upperDepth : depthC;

    if (!isUpper) {
      if (orientAB === 'edge_A') {
        corners.push({
          id: 'corner_AB',
          x: 0,
          y: 0,
          width: wBaseAB,
          height: depthA,
          label: `Góc AB (${wBaseAB}x${depthA}) - Quay Cạnh A`,
          orientation: 'edge_A',
          tier: 'base',
          deadWidth: depthB,
          deadHeight: depthA,
          usableWidth: wBaseAB - depthB,
          usableHeight: depthA,
        });
      } else {
        corners.push({
          id: 'corner_AB',
          x: 0,
          y: 0,
          width: depthB,
          height: wBaseAB,
          label: `Góc AB (${depthB}x${wBaseAB}) - Quay Cạnh B`,
          orientation: 'edge_B',
          tier: 'base',
          deadWidth: depthB,
          deadHeight: depthA,
          usableWidth: depthB,
          usableHeight: wBaseAB - depthA,
        });
      }

      if (orientAC === 'edge_A') {
        corners.push({
          id: 'corner_AC',
          x: lengthA - wBaseAC,
          y: 0,
          width: wBaseAC,
          height: depthA,
          label: `Góc AC (${wBaseAC}x${depthA}) - Quay Cạnh A`,
          orientation: 'edge_A',
          tier: 'base',
          deadWidth: depthC,
          deadHeight: depthA,
          usableWidth: wBaseAC - depthC,
          usableHeight: depthA,
        });
      } else {
        corners.push({
          id: 'corner_AC',
          x: lengthA - depthC,
          y: 0,
          width: depthC,
          height: wBaseAC,
          label: `Góc AC (${depthC}x${wBaseAC}) - Quay Cạnh C`,
          orientation: 'edge_C',
          tier: 'base',
          deadWidth: depthC,
          deadHeight: depthA,
          usableWidth: depthC,
          usableHeight: wBaseAC - depthA,
        });
      }
    } else {
      if (orientAB === 'edge_A') {
        upperCorners.push({
          id: 'upper_corner_AB',
          x: 0,
          y: 0,
          width: wUpperAB,
          height: upperDepth,
          label: 'Góc tủ trên AB - Quay Cạnh A',
          orientation: 'edge_A',
          tier: 'upper',
          deadWidth: upperDepth,
          deadHeight: upperDepth,
          usableWidth: wUpperAB - upperDepth,
          usableHeight: upperDepth,
        });
      } else {
        upperCorners.push({
          id: 'upper_corner_AB',
          x: 0,
          y: 0,
          width: upperDepth,
          height: wUpperAB,
          label: 'Góc tủ trên AB - Quay Cạnh B',
          orientation: 'edge_B',
          tier: 'upper',
          deadWidth: upperDepth,
          deadHeight: upperDepth,
          usableWidth: upperDepth,
          usableHeight: wUpperAB - upperDepth,
        });
      }

      if (orientAC === 'edge_A') {
        upperCorners.push({
          id: 'upper_corner_AC',
          x: lengthA - wUpperAC,
          y: 0,
          width: wUpperAC,
          height: upperDepth,
          label: 'Góc tủ trên AC - Quay Cạnh A',
          orientation: 'edge_A',
          tier: 'upper',
          deadWidth: upperDepth,
          deadHeight: upperDepth,
          usableWidth: wUpperAC - upperDepth,
          usableHeight: upperDepth,
        });
      } else {
        upperCorners.push({
          id: 'upper_corner_AC',
          x: lengthA - upperDepth,
          y: 0,
          width: upperDepth,
          height: wUpperAC,
          label: 'Góc tủ trên AC - Quay Cạnh C',
          orientation: 'edge_C',
          tier: 'upper',
          deadWidth: upperDepth,
          deadHeight: upperDepth,
          usableWidth: upperDepth,
          usableHeight: wUpperAC - upperDepth,
        });
      }
    }

    const modulesB = layout.placedModules
      .filter((m) => m.edgeId === 'edge_B')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let currentYB = orientAB === 'edge_B' ? wBaseAB : curDepthA;
    for (const m of modulesB) {
      modules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_B',
        x: 0,
        y: currentYB,
        width: curDepthB,
        height: m.width,
        rotation: 90,
        centerX: curDepthB / 2,
        centerY: currentYB + m.width / 2,
      });
      currentYB += m.width;
    }

    const modulesA = layout.placedModules
      .filter((m) => m.edgeId === 'edge_A')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let currentXA = orientAB === 'edge_A' ? wBaseAB : curDepthB;
    for (const m of modulesA) {
      modules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_A',
        x: currentXA,
        y: 0,
        width: m.width,
        height: curDepthA,
        rotation: 0,
        centerX: currentXA + m.width / 2,
        centerY: curDepthA / 2,
      });
      currentXA += m.width;
    }

    const modulesC = layout.placedModules
      .filter((m) => m.edgeId === 'edge_C')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let currentYC = orientAC === 'edge_C' ? wBaseAC : curDepthA;
    for (const m of modulesC) {
      modules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_C',
        x: lengthA - curDepthC,
        y: currentYC,
        width: curDepthC,
        height: m.width,
        rotation: -90,
        centerX: lengthA - curDepthC / 2,
        centerY: currentYC + m.width / 2,
      });
      currentYC += m.width;
    }

    const upperModulesB = (layout.placedUpperModules || [])
      .filter((m) => m.edgeId === 'edge_B')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let curUpperYB = orientAB === 'edge_B' ? wUpperAB : upperDepth;
    for (const m of upperModulesB) {
      const y = m.offset !== undefined ? m.offset : curUpperYB;
      upperModules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_B',
        x: 0,
        y,
        width: upperDepth,
        height: m.width,
        rotation: 90,
        centerX: upperDepth / 2,
        centerY: y + m.width / 2,
      });
      curUpperYB = y + m.width;
    }

    const upperModulesA = (layout.placedUpperModules || [])
      .filter((m) => m.edgeId === 'edge_A')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let curUpperXA = orientAB === 'edge_A' ? wUpperAB : upperDepth;
    for (const m of upperModulesA) {
      const x = m.offset !== undefined ? m.offset : curUpperXA;
      upperModules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_A',
        x,
        y: 0,
        width: m.width,
        height: upperDepth,
        rotation: 0,
        centerX: x + m.width / 2,
        centerY: upperDepth / 2,
      });
      curUpperXA = x + m.width;
    }

    const upperModulesC = (layout.placedUpperModules || [])
      .filter((m) => m.edgeId === 'edge_C')
      .sort((a, b) => a.positionIndex - b.positionIndex);

    let curUpperYC = orientAC === 'edge_C' ? wUpperAC : upperDepth;
    for (const m of upperModulesC) {
      const y = m.offset !== undefined ? m.offset : curUpperYC;
      upperModules2D.push({
        instanceId: m.instanceId,
        code: m.code,
        name: m.name,
        category: m.category,
        edgeId: 'edge_C',
        x: lengthA - upperDepth,
        y,
        width: upperDepth,
        height: m.width,
        rotation: -90,
        centerX: lengthA - upperDepth / 2,
        centerY: y + m.width / 2,
      });
      curUpperYC = y + m.width;
    }

    return {
      modules: modules2D,
      corners,
      upperModules: upperModules2D,
      upperCorners,
      upperGaps: computeUpperGaps(layout, tier),
      baseGaps: computeBaseGaps(layout, tier),
      totalWidth: lengthA,
      totalHeight: Math.max(lengthB, lengthC),
      minX: 0,
      minY: 0,
      maxX: lengthA,
      maxY: Math.max(lengthB, lengthC),
    };
  }
}

export function getDistanceBetweenModules(
  modA: Module2DBox,
  modB: Module2DBox
): number {
  const dx = modA.centerX - modB.centerX;
  const dy = modA.centerY - modB.centerY;
  return Math.round(Math.sqrt(dx * dx + dy * dy));
}

/**
 * Tính khoảng cách thực tế giữa 2 Module2DBox (mm).
 * - Nếu cùng cạnh: khoảng hở mép tới mép (edge-to-edge gap) dọc theo cạnh đó.
 * - Nếu khác cạnh: khoảng cách Euclide 2D tâm tới tâm.
 */
export function getModuleGap(
  modA: Module2DBox,
  modB: Module2DBox
): number {
  if (modA.edgeId === modB.edgeId) {
    if (modA.edgeId === 'edge_A') {
      const [left, right] = modA.x <= modB.x ? [modA, modB] : [modB, modA];
      return Math.max(0, right.x - (left.x + left.width));
    } else {
      // edge_B hoặc edge_C: các khoang chạy dọc theo trục Y (y đến y + height)
      const [top, bottom] = modA.y <= modB.y ? [modA, modB] : [modB, modA];
      return Math.max(0, bottom.y - (top.y + top.height));
    }
  }
  return getDistanceBetweenModules(modA, modB);
}

/**
 * Tính khoảng cách mép-tới-mép (edge-to-edge gap) giữa 2 khoang nằm trên cùng 1 cạnh
 */
export function getEdgeClearanceBetweenModules(
  modA: PlacedModuleInstance,
  modB: PlacedModuleInstance
): number {
  if (modA.edgeId !== modB.edgeId) return -1;
  const [first, second] = modA.offset <= modB.offset ? [modA, modB] : [modB, modA];
  return Math.max(0, second.offset - (first.offset + first.width));
}

/**
 * Tính chiều dài khả dụng của một cạnh (đã trừ khoảng góc nối)
 */
export function getAvailableEdgeLength(
  layout: KitchenLayout,
  edgeId: EdgeId
): number {
  const depthA = layout.edgeA.depth || 600;
  const depthB = layout.edgeB?.depth || 600;
  const depthC = layout.edgeC?.depth || 600;
  const orientAB = layout.cornerOrientationAB || 'edge_A';
  const orientAC = layout.cornerOrientationAC || 'edge_A';
  const wBaseAB = layout.cornerWidthBaseAB || 1000;
  const wBaseAC = layout.cornerWidthBaseAC || 1000;

  if (layout.shape === 'I') {
    return layout.edgeA.length;
  }

  if (layout.shape === 'L') {
    if (edgeId === 'edge_A') {
      const occ = orientAB === 'edge_A' ? wBaseAB : depthB;
      return Math.max(0, layout.edgeA.length - occ);
    }
    if (edgeId === 'edge_B' && layout.edgeB) {
      const occ = orientAB === 'edge_B' ? wBaseAB : depthA;
      return Math.max(0, layout.edgeB.length - occ);
    }
    return 0;
  }

  if (layout.shape === 'U') {
    if (edgeId === 'edge_A') {
      const occAB = orientAB === 'edge_A' ? wBaseAB : depthB;
      const occAC = orientAC === 'edge_A' ? wBaseAC : depthC;
      return Math.max(0, layout.edgeA.length - occAB - occAC);
    }
    if (edgeId === 'edge_B' && layout.edgeB) {
      const occ = orientAB === 'edge_B' ? wBaseAB : depthA;
      return Math.max(0, layout.edgeB.length - occ);
    }
    if (edgeId === 'edge_C' && layout.edgeC) {
      const occ = orientAC === 'edge_C' ? wBaseAC : depthA;
      return Math.max(0, layout.edgeC.length - occ);
    }
  }

  return 0;
}
