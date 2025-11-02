import { Gauge, GameState, Parts, PlayerInfo, Action, Position, ActiveEffects } from '../core/components/index.js';
import { BattleContext } from '../core/index.js';
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { PlayerStateType, ModalType, BattlePhase, TeamID, EffectType, EffectScope, PartInfo, TargetTiming } from '../common/constants.js';
import { isValidTarget } from '../utils/queryUtils.js';
import { CombatCalculator } from '../utils/combatFormulas.js';
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * エンティティの「状態」を管理するステートマシンとしての役割を担うシステム。
 * 責務を削減し、状態遷移ロジックのコア部分に特化させました。
 * - 行動選択後のセットアップは ActionSetupSystem へ移譲。
 * - 行動完了後のクールダウン移行は CooldownSystem へ移譲。
 */
export class StateSystem {
    constructor(world) {
        this.world = world;
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.world.on(GameEvents.COMBAT_SEQUENCE_RESOLVED, this.onCombatSequenceResolved.bind(this));
        this.world.on(GameEvents.GAUGE_FULL, this.onGaugeFull.bind(this));
        this.world.on(GameEvents.PLAYER_BROKEN, this.onPlayerBroken.bind(this));
        // クールダウン移行に関連するイベント購読を CooldownSystem に移譲
    }
    
    onPlayerBroken(detail) {
        const { entityId } = detail;
        const gameState = this.world.getComponent(entityId, GameState);
        const gauge = this.world.getComponent(entityId, Gauge);

        if (gameState) {
            gameState.state = PlayerStateType.BROKEN;
        }
        if (gauge) {
            gauge.value = 0;
        }
        this.world.addComponent(entityId, new Action());
    }

    /**
     * 妨害やガードといった、行動解決時に即座に状態を変化させる効果を処理します。
     * @param {object} detail 
     */
    onCombatSequenceResolved(detail) {
        const { appliedEffects, attackerId } = detail;
        if (!appliedEffects || appliedEffects.length === 0) {
            return;
        }

        for (const effect of appliedEffects) {
            if (effect.type === EffectType.APPLY_GLITCH && effect.wasSuccessful) {
                // 妨害成功時、ターゲットを強制的にクールダウンへ
                // CooldownSystem が ACTION_CANCELLED を購読しているため、イベントを発行して処理を委譲
                // ★★★ 修正: MessageSystemなどが理由を判別できるよう 'INTERRUPTED' を追加 ★★★
                this.world.emit(GameEvents.ACTION_CANCELLED, { entityId: effect.targetId, reason: 'INTERRUPTED' });
            } 
            else if (effect.type === EffectType.APPLY_GUARD) {
                // ガード成功時、自身の状態をガード中へ
                const gameState = this.world.getComponent(attackerId, GameState);
                if (gameState) {
                    gameState.state = PlayerStateType.GUARDING;
                    
                    const position = this.world.getComponent(attackerId, Position);
                    const playerInfo = this.world.getComponent(attackerId, PlayerInfo);
                    if (position && playerInfo) {
                        position.x = playerInfo.teamId === TeamID.TEAM1
                            ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1
                            : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
                    }
                }
            }
        }
    }

    onGaugeFull(detail) {
        const { entityId } = detail;
        const gauge = this.world.getComponent(entityId, Gauge);
        const gameState = this.world.getComponent(entityId, GameState);

        if (!gauge || !gameState) return;

        if (gameState.state === PlayerStateType.CHARGING) {
            gameState.state = PlayerStateType.READY_SELECT;
            this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId });
        } 
        else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
            gameState.state = PlayerStateType.READY_EXECUTE;

            const position = this.world.getComponent(entityId, Position);
            const playerInfo = this.world.getComponent(entityId, PlayerInfo);
            if (position && playerInfo) {
                position.x = playerInfo.teamId === TeamID.TEAM1
                    ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1
                    : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
            }
        }
    }
    
    update(deltaTime) {
        // このシステムはイベント駆動のため、update処理は不要です。
    }
}