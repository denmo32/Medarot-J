// scripts/systems/gaugeSystem.js:

import { Gauge, GameState, GameContext, Parts } from '../core/components.js';
import { CONFIG } from '../common/config.js';
import { PlayerStateType, GamePhaseType } from '../common/constants.js';
import { BaseSystem } from '../core/baseSystem.js';

export class GaugeSystem extends BaseSystem {
    constructor(world) {
        super(world);
        // GameContextへの参照を保持
        this.context = this.world.getSingletonComponent(GameContext);
    }

    update(deltaTime) {
        // バトルフェーズでない場合、またはモーダル表示によりゲーム全体が一時停止している場合は、
        // ゲージの進行を停止する
        if (this.context.phase !== GamePhaseType.BATTLE || this.context.isPausedByModal) {
            return;
        }

        const entities = this.world.getEntitiesWith(Gauge, GameState, Parts);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);
            const gameState = this.world.getComponent(entityId, GameState);
            const parts = this.world.getComponent(entityId, Parts);

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

            // 脚部パーツの推進力を取得。見つからなければデフォルト値1を代入
            const propulsion = parts.legs?.propulsion || 1;

            // ★変更: speedMultiplierを考慮してゲージを増加させる
            const speedMultiplier = gauge.speedMultiplier || 1.0;
            const increment = (propulsion / CONFIG.FORMULAS.GAUGE.GAUGE_INCREMENT_DIVISOR) * (deltaTime / CONFIG.UPDATE_INTERVAL) / speedMultiplier;
            gauge.value += increment;

            // ゲージが最大値を超えないようにする
            if (gauge.value >= gauge.max) {
                gauge.value = gauge.max;
            }
        }
    }
}