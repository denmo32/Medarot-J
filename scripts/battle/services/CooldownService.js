/**
 * @file CooldownService.js
 * @description クールダウン（放熱）状態への遷移処理を提供するサービスクラス。
 */
import { GameEvents } from '../../common/events.js';
import { Action, GameState, Gauge, ActiveEffects } from '../components/index.js';
import { Parts } from '../../components/index.js';
import { PlayerStateType } from '../common/constants.js';
import { EffectType } from '../../common/constants.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { PlayerStatusService } from './PlayerStatusService.js';

export class CooldownService {
    /**
     * エンティティをクールダウン（充填完了後の帰り）状態へ遷移させる
     * @param {World} world 
     * @param {number} entityId 
     */
    static transitionToCooldown(world, entityId) {
        const parts = world.getComponent(entityId, Parts);
        if (parts?.head?.isBroken) return;

        const gameState = world.getComponent(entityId, GameState);
        
        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            world.addComponent(entityId, new Action());
            return;
        }

        const gauge = world.getComponent(entityId, Gauge);
        const action = world.getComponent(entityId, Action);

        // 速度計算
        if (action && action.partKey && parts && gauge) {
            const usedPart = parts[action.partKey];
            if (usedPart) {
                // 修正: world, entityId を渡す
                gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({ 
                    world, 
                    entityId, 
                    part: usedPart, 
                    factorType: 'cooldown' 
                });
            }
        } else if (gauge) {
            gauge.speedMultiplier = 1.0;
        }

        PlayerStatusService.transitionTo(world, entityId, PlayerStateType.CHARGING);
        
        if (gauge) {
            gauge.value = 0;
            gauge.currentSpeed = 0;
        }
        
        world.addComponent(entityId, new Action());
        
        world.emit(GameEvents.COOLDOWN_TRANSITION_COMPLETED, { entityId });
    }

    /**
     * エンティティを強制的にクールダウン開始状態へリセットする
     * @param {World} world 
     * @param {number} entityId 
     * @param {object} options 
     */
    static resetEntityStateToCooldown(world, entityId, options = {}) {
        const { interrupted = false } = options;
        const parts = world.getComponent(entityId, Parts);
        
        if (parts?.head?.isBroken) {
            return;
        }
        
        const gameState = world.getComponent(entityId, GameState);
        const gauge = world.getComponent(entityId, Gauge);
        
        if (gameState && gameState.state === PlayerStateType.GUARDING) {
            const activeEffects = world.getComponent(entityId, ActiveEffects);
            if (activeEffects) {
                activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
            }
        }
        
        PlayerStatusService.transitionTo(world, entityId, PlayerStateType.CHARGING);
        
        if (gauge) {
            if (interrupted) {
                gauge.value = gauge.max - gauge.value;
            } else {
                gauge.value = 0;
            }
            gauge.currentSpeed = 0;
            gauge.speedMultiplier = 1.0;
        }
        
        world.addComponent(entityId, new Action());
    }
}