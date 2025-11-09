import { Gauge, GameState, Parts, PlayerInfo, Action, Position, ActiveEffects } from '../core/components/index.js';
import { BattleContext } from '../core/index.js';
import { CONFIG } from '../common/config.js';
import { GameEvents } from '../common/events.js';
import { PlayerStateType, ModalType, BattlePhase, TeamID, EffectType, EffectScope, PartInfo, TargetTiming, ActionCancelReason } from '../common/constants.js';
import { isValidTarget } from '../utils/queryUtils.js';
import { snapToActionLine } from '../utils/positionUtils.js';
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
        // HPバーアニメーション完了イベントを購読
        this.world.on(GameEvents.HP_BAR_ANIMATION_COMPLETED, this.onHpBarAnimationCompleted.bind(this));
        // クールダウン移行に関連するイベント購読を CooldownSystem に移譲
    }
    
    /**
     * HPバーアニメーション完了後に、機体の状態を「破壊済み」に遷移させます。
     * @param {object} detail - HP_BAR_ANIMATION_COMPLETED イベントのペイロード
     */
    onHpBarAnimationCompleted(detail) {
        const { appliedEffects } = detail;
        if (!appliedEffects) return;

        for (const effect of appliedEffects) {
            if (effect.isPlayerBroken) {
                const { targetId: entityId } = effect;
                const gameState = this.world.getComponent(entityId, GameState);
                const gauge = this.world.getComponent(entityId, Gauge);

                if (gameState) {
                    gameState.state = PlayerStateType.BROKEN;
                }
                if (gauge) {
                    gauge.value = 0;
                }
                this.world.addComponent(entityId, new Action());

                // 破壊イベントをここで発行
                const playerInfo = this.world.getComponent(entityId, PlayerInfo);
                if (playerInfo) {
                    this.world.emit(GameEvents.PLAYER_BROKEN, { entityId, teamId: playerInfo.teamId });
                }
            }
        }
    }

    /**
     * ガード効果など、行動解決時に即座に状態を変化させる効果を処理します。
     * @param {object} detail 
     */
    onCombatSequenceResolved(detail) {
        const { appliedEffects, attackerId } = detail;
        if (!appliedEffects || appliedEffects.length === 0) {
            return;
        }

        for (const effect of appliedEffects) {
            // 妨害効果の処理を削除。glitchApplicatorが担当する。
            if (effect.type === EffectType.APPLY_GUARD) {
                // ガード成功時、自身の状態をガード中へ
                const gameState = this.world.getComponent(attackerId, GameState);
                if (gameState) {
                    gameState.state = PlayerStateType.GUARDING;
                    
                    // 位置設定ロジックを共通関数に置き換え
                    snapToActionLine(this.world, attackerId);
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

            // 位置設定ロジックを共通関数に置き換え
            snapToActionLine(this.world, entityId);
        }
    }
    
    update(deltaTime) {
        // このシステムはイベント駆動のため、update処理は不要です。
    }
}