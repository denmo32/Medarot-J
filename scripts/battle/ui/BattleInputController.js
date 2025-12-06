/**
 * @file BattleInputController.js
 * @description バトル中のUI（特にモーダル）に対する入力操作を解釈し、ハンドラを実行するコントローラー。
 * ActionPanelSystemから入力判定ロジックを分離。
 */
export class BattleInputController {
    /**
     * @param {InputManager} inputManager
     * @param {BattleUIState} uiState
     * @param {object} handlers modalHandlers定義
     */
    constructor(inputManager, uiState, handlers) {
        this.inputManager = inputManager;
        this.uiState = uiState;
        this.handlers = handlers;
    }

    /**
     * 現在の入力状態に基づいて操作を実行する
     * @param {object} ctx - ハンドラに渡すコンテキスト (ModalHandlerContext)
     */
    handleInput(ctx) {
        if (!this.inputManager || !this.uiState.currentModalType) return;

        const handler = this.handlers[this.uiState.currentModalType];
        if (!handler) return;

        // ナビゲーション (矢印キー)
        if (handler.handleNavigation) {
            const navKeys = [
                { key: 'ArrowUp', direction: 'arrowup' },
                { key: 'ArrowDown', direction: 'arrowdown' },
                { key: 'ArrowLeft', direction: 'arrowleft' },
                { key: 'ArrowRight', direction: 'arrowright' }
            ];

            for (const { key, direction } of navKeys) {
                if (this.inputManager.wasKeyJustPressed(key)) {
                    handler.handleNavigation(ctx, direction);
                }
            }
        }

        // 決定 (Zキー)
        if (this.inputManager.wasKeyJustPressed('z')) {
            handler.handleConfirm?.(ctx, this.uiState.currentModalData);
        }

        // キャンセル (Xキー)
        if (this.inputManager.wasKeyJustPressed('x')) {
            handler.handleCancel?.(ctx, this.uiState.currentModalData);
        }
    }
}