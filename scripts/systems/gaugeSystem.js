// scripts/systems/gaugeSystem.js:

import { Gauge, GameState, GamePhase } from '../components.js';
import { CONFIG } from '../config.js';
import { PlayerStateType, GamePhaseType } from '../constants.js';

export class GaugeSystem {
    constructor(world) {
        this.world = world;
    }

    update(deltaTime) {
        const [gamePhaseEntity] = this.world.getEntitiesWith(GamePhase);
        const gamePhase = this.world.getComponent(gamePhaseEntity, GamePhase);

        // activePlayerがいる、モーダル表示中、またはバトルフェーズ以外ではゲージを進めない
        // 比較を定数に変更
        if (gamePhase.activePlayer || gamePhase.isModalActive || gamePhase.phase !== GamePhaseType.BATTLE) {
            return;
        }

        const entities = this.world.getEntitiesWith(Gauge, GameState);

        for (const entityId of entities) {
            const gauge = this.world.getComponent(entityId, Gauge);
            const gameState = this.world.getComponent(entityId, GameState);

            // 比較を定数に変更
            const statesToPause = [
                PlayerStateType.READY_SELECT, 
                PlayerStateType.READY_EXECUTE, 
                PlayerStateType.COOLDOWN_COMPLETE, 
                PlayerStateType.BROKEN
            ];
            if (statesToPause.includes(gameState.state)) {
                continue;
            }

            const increment = gauge.speed * (deltaTime / CONFIG.UPDATE_INTERVAL);
            gauge.value += increment;

            if (gauge.value >= gauge.max) {
                gauge.value = gauge.max;
            }
        }
    }
}