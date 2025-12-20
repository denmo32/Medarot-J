/**
 * @file UIInputSystem.js
 * @description UI操作に関連する物理入力をリッスンし、抽象的なIntentコンポーネントを生成するシステム。
 * イベント発行を廃止し、データ指向のアプローチへ変更。
 */
import { System } from '../../../../engine/core/System.js';
import { InputManager } from '../../../../engine/input/InputManager.js';
import { BattleUIState } from '../../components/index.js';
import { UIInputState } from '../../components/States.js';

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

        // 1フレームにつき1つのインテントのみ生成する（優先度順）

        // 決定
        if (this.input.wasKeyJustPressed('z')) {
            this._createIntent('CONFIRM');
            return;
        }

        // キャンセル
        if (this.input.wasKeyJustPressed('x')) {
            this._createIntent('CANCEL');
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
                this._createIntent('NAVIGATE', { direction });
                return;
            }
        }
    }

    _createIntent(type, data = {}) {
        const stateEntity = this.world.createEntity();
        const uiInputState = new UIInputState();
        uiInputState.isActive = true;
        uiInputState.type = type;
        uiInputState.data = data;
        this.world.addComponent(stateEntity, uiInputState);
    }
}