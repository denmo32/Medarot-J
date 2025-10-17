import { PlayerInfo, Position, Gauge, GameState, Parts } from '../core/components/index.js';
import { PlayerStateType, TeamID } from '../common/constants.js';
import { BaseSystem } from '../../core/baseSystem.js';
import { UIManager } from './UIManager.js';

/**
 * @file Render System
 * @description このシステムは廃止されました。
 * DOM要素の更新はUISystemが、アニメーションはViewSystemが担当します。
 * このファイルは後方互換性のために残されていますが、機能はしません。
 */
export class RenderSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // This system is deprecated. All logic has been moved.
    }
    update(deltaTime) {
        // This system is deprecated. No update logic.
    }
}