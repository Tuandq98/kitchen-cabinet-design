import React, { useState, useEffect } from 'react';
import { useKitchenStore } from './store/useKitchenStore';
import { Header } from './components/header/Header';
import { LeftSidebar } from './components/sidebar-left/LeftSidebar';
import { RightSidebar } from './components/sidebar-right/RightSidebar';
import { KitchenCanvas2D } from './components/canvas/KitchenCanvas2D';
import { DimensionsModal } from './components/modals/DimensionsModal';
import { CatalogManagerModal } from './components/modals/CatalogManagerModal';
import { RuleManagerModal } from './components/modals/RuleManagerModal';
import { KitchenSetupWizard } from './components/modals/KitchenSetupWizard';
import confetti from 'canvas-confetti';

export function App() {
  const {
    layout,
    designPhase,
    setDesignPhase,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedModuleId,
    removePlacedModule,
    setSelectedModuleId,
    validationReport,
  } = useKitchenStore();

  const [isDimensionsOpen, setIsDimensionsOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  // Keyboard Shortcuts (Undo, Redo, Delete, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (e.target as HTMLElement).tagName
        )
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (canRedo) redo();
      } else if (e.key === 'Escape') {
        setSelectedModuleId(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedModuleId) {
          removePlacedModule(selectedModuleId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, selectedModuleId, undo, redo, removePlacedModule, setSelectedModuleId]);

  // Kích hoạt pháo hoa khi đạt 100 điểm thiết kế chuẩn NKBA
  useEffect(() => {
    if (validationReport.score === 100 && validationReport.hardValid) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    }
  }, [validationReport.score, validationReport.hardValid]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      {/* 1. Top Navigation Bar */}
      <Header
        onOpenDimensionsModal={() => setIsDimensionsOpen(true)}
        onOpenProjectModal={() => {}}
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Catalog, Auto Generator, Rules, Projects */}
        <LeftSidebar
          onOpenCatalogModal={() => setIsCatalogOpen(true)}
          onOpenRulesModal={() => setIsRulesOpen(true)}
        />

        {/* Center: Interactive Architectural 2D Canvas */}
        <KitchenCanvas2D />

        {/* Right Sidebar: Module Inspector & Validation Quality Report */}
        <RightSidebar />
      </div>

      {/* 3. Dialogs & Modals */}
      <KitchenSetupWizard
        isOpen={designPhase === 'setup'}
        onClose={() => {
          if (layout.placedModules.length > 0) {
            setDesignPhase('design_base');
          }
        }}
      />

      <DimensionsModal
        isOpen={isDimensionsOpen}
        onClose={() => setIsDimensionsOpen(false)}
      />

      <CatalogManagerModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
      />

      <RuleManagerModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </div>
  );
}

export default App;
