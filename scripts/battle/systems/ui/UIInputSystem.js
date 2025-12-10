/**
 * @file UIInputSystem.js
 * @description UI操作に関連する物理入力をリッスンし、抽象的なUIイベントを発行するシステム。
 */
import { System } from '../../../../engine/core/System.js';
import { InputManager } from '../../../../engine/input/InputManager.js';
import { GameEvents } from '../../../common/events.js';
import { BattleUIState } from '../../components/index.js';

export class UIInputSystem extends System {
    constructor(world) {
        super(world);
        this.input = this.world.getSingletonComponent(InputManager);
        this.uiState = this.world.getSingletonComponent(BattleUIState);
    }

    update(deltaTime) {
        if (!this.input || !this.uiState || !this.uiState.isPanelVisible) {
            return;
        }

        // ナビゲーション
        const navKeys = [
            { key: 'ArrowUp', direction: 'arrowup' },
            { key: 'ArrowDown', direction: 'arrowdown' },
            { key: 'ArrowLeft', direction: 'arrowleft' },
            { key: 'ArrowRight', direction: 'arrowright' }
        ];

        for (const { key, direction } of navKeys) {
            if (this.input.wasKeyJustPressed(key)) {
                this.world.emit(GameEvents.UI_NAVIGATE, { direction });
                return; // 1フレームに1入力
            }
        }

        // 決定
        if (this.input.wasKeyJustPressed('z')) {
            this.world.emit(GameEvents.UI_CONFIRM);
        }

        // キャンセル
        if (this.input.wasKeyJustPressed('x')) {
            this.world.emit(GameEvents.UI_CANCEL);
        }
    }
}