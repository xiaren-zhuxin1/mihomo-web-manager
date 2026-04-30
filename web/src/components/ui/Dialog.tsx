import React from 'react';
import { useApp } from '../../contexts/AppContext';

export function ConfirmDialog() {
  const { dialog, closeDialog } = useApp();

  if (!dialog.open) return null;

  const handleConfirm = () => {
    dialog.onConfirm?.();
    closeDialog();
  };

  return (
    <div className="dialogOverlay" onClick={closeDialog}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialogHeader">
          <h3>{dialog.title}</h3>
        </div>
        <div className="dialogBody">
          <p>{dialog.message}</p>
        </div>
        <div className="dialogFooter">
          <button className="dialogCancel" onClick={closeDialog}>取消</button>
          <button className={`dialogConfirm ${dialog.variant || 'default'}`} onClick={handleConfirm}>
            {dialog.confirmText || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}
