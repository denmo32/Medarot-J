// scripts/systems/gaugeSystem.js:

import { Gauge, GameState, GameContext } from '../components.js';
import { CONFIG } from '../config.js';
import { PlayerStateType, GamePhaseType } from '../constants.js';

export class GaugeSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
        this.context = this.world.getSingletonComponent(GameContext);
    }

    update(deltaTime) {
        // ★変更: ゲームの進行停止条件を修正。
        // バトルフェーズでない場合、またはモーダル表示によりゲーム全体が一時停止している場合は、
        // ゲージの進行を停止するように修正しました。UIの状態(activePlayer)への依存をなくしました。
        if (this.context.phase !== GamePhaseType.BATTLE || this.context.isPausedByModal) {
            return;
        }

        const entities = this.world.getEntitiesWith(Gauge, GameState);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);
            const gameState = this.world.getComponent(entityId, GameState);

            // ゲージの進行を止めるべき状態かを判定
            const statesToPause = [
                PlayerStateType.READY_SELECT, 
                PlayerStateType.READY_EXECUTE, 
                PlayerStateType.COOLDOWN_COMPLETE, 
                PlayerStateType.BROKEN
            ];
            if (statesToPause.includes(gameState.state)) {
                continue;
            }

            // ゲージを増加させる
            const increment = gauge.speed * (deltaTime / CONFIG.UPDATE_INTERVAL);
            gauge.value += increment;

            // ゲージが最大値を超えないようにする
            if (gauge.value >= gauge.max) {
                gauge.value = gauge.max;
            }
        }
    }
}