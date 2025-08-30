// scripts/systems/gaugeSystem.js:

import { Gauge, GameState, GameContext } from '../components.js';
import { CONFIG } from '../config.js';
import { PlayerStateType, GamePhaseType } from '../constants.js';

export class GaugeSystem {
    constructor(world) {
        this.world = world;
        // GameContextへの参照を保持
        const contextEntity = this.world.getEntitiesWith(GameContext)[0];
        this.context = this.world.getComponent(contextEntity, GameContext);
    }

    update(deltaTime) {
        // activePlayerがいる、モーダル表示中、またはバトルフェーズ以外ではゲージを進めない
        if (this.context.activePlayer || this.context.isModalActive || this.context.phase !== GamePhaseType.BATTLE) {
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