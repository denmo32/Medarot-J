/**
 * @file カスタマイズ画面：入力システム
 * プレイヤーのキー入力を検知し、それを抽象的なUI操作イベントに変換して発行する責務を持ちます。
 * このシステムはDOMの状態やゲームデータについて一切関知しません。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { InputManager } from '../../core/InputManager.js';
import { CustomizeState } from '../components/CustomizeState.js';

export class CustomizeInputSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.input = new InputManager();
        this.uiState = this.world.getSingletonComponent(CustomizeState);
    }

    update(deltaTime) {
        // --- 決定/キャンセル入力 ---
        if (this.input.wasKeyJustPressed('z')) {
            this.world.emit('CUST_CONFIRM_INPUT');
        } else if (this.input.wasKeyJustPressed('x')) {
            this.world.emit('CUST_CANCEL_INPUT');
        }

        // --- ナビゲーション入力 ---
        const verticalMove = this.input.wasKeyJustPressed('ArrowDown') ? 1 : this.input.wasKeyJustPressed('ArrowUp') ? -1 : 0;
        if (verticalMove !== 0) {
            this.world.emit('CUST_NAVIGATE_INPUT', { direction: verticalMove > 0 ? 'down' : 'up' });
        }
        
        // 将来的な水平移動のために残しておく
        // const horizontalMove = this.input.wasKeyJustPressed('ArrowRight') ? 1 : this.input.wasKeyJustPressed('ArrowLeft') ? -1 : 0;
        // if (horizontalMove !== 0) {
        //     this.world.emit('CUST_NAVIGATE_INPUT', { direction: horizontalMove > 0 ? 'right' : 'left' });
        // }
    }
}