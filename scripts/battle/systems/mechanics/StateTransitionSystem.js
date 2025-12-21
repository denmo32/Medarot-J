/**
 * @file StateTransitionSystem.js
 * @description 状態遷移リクエスト処理システム。
 * QueryService, EffectService -> BattleQueries, StatCalculator
 */
import { System } from '../../../../engine/core/System.js';
import { 
    Gauge, Action, ActiveEffects, Position,
    // Tag classes
    IsReadyToSelect, IsReadyToExecute, IsCharging, IsCooldown, 
    IsGuarding, IsBroken, IsAwaitingAnimation,
    // Tag groups
    PlayerStateTags
} from '../../components/index.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import {
    TransitionStateRequest,
    ResetToCooldownRequest,
    HandleGaugeFullRequest, 
    SetPlayerBrokenRequest,
    SnapToActionLineRequest,
    TransitionToCooldownRequest,
} from '../../components/CommandRequests.js';
import { ActionRequeueState } from '../../components/States.js';
import {
    PlayerBrokenEvent,
    GaugeFullTag
} from '../../components/Requests.js';
import { PlayerStateType, EffectType } from '../../common/constants.js';
import { TeamID } from '../../../common/constants.js';
import { CONFIG } from '../../common/config.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { StatCalculator } from '../../logic/StatCalculator.js';
import { BattleQueries } from '../../queries/BattleQueries.js';

export class StateTransitionSystem extends System {
    constructor(world) {
        super(world);
        // State定数とTagクラスのマッピング
        this.stateToTagMap = {
            [PlayerStateType.READY_SELECT]: IsReadyToSelect,
            [PlayerStateType.READY_EXECUTE]: IsReadyToExecute,
            [PlayerStateType.SELECTED_CHARGING]: IsCharging,
            [PlayerStateType.CHARGING]: IsCooldown,
            [PlayerStateType.GUARDING]: IsGuarding,
            [PlayerStateType.BROKEN]: IsBroken,
            [PlayerStateType.AWAITING_ANIMATION]: IsAwaitingAnimation
        };
    }

    update(deltaTime) {
        this._processGaugeFullTags();
        this._processTransitionStateRequests();
        this._processHandleGaugeFullRequests();
        
        // 以下はより具体的なロジックを含むリクエスト処理
        this._processResetToCooldownRequests();
        this._processTransitionToCooldownRequests();
        this._processSetPlayerBrokenRequests();
        this._processSnapToActionLineRequests();
    }

    _clearStateTags(entityId) {
        PlayerStateTags.forEach(Tag => this.world.removeComponent(entityId, Tag));
    }

    _setStateTag(entityId, newState) {
        this._clearStateTags(entityId);
        const TagClass = this.stateToTagMap[newState];
        if (TagClass) {
            this.world.addComponent(entityId, new TagClass());
        }
    }

    _hasStateTag(entityId, TagClass) {
        return this.world.getComponent(entityId, TagClass) !== null;
    }

    /**
     * 状態タグの更新とゲージのアクティブ制御を即時実行するヘルパー
     * @private
     */
    _applyStateTransition(targetId, newState) {
        this._setStateTag(targetId, newState);

        const gauge = this.world.getComponent(targetId, Gauge);
        if (gauge) {
            // ゲージのActive状態制御
            const isActive = newState === PlayerStateType.SELECTED_CHARGING || 
                             newState === PlayerStateType.CHARGING;
            gauge.isActive = isActive;
            
            // 機能停止時はゲージ完全リセット
            if (newState === PlayerStateType.BROKEN) {
                this._resetGauge(targetId);
            }
        }

        // ラインへのスナップ要求
        if (newState === PlayerStateType.GUARDING || newState === PlayerStateType.READY_EXECUTE) {
            this.world.addComponent(this.world.createEntity(), new SnapToActionLineRequest(targetId));
        }
    }

    // --- Core Logic Helpers ---

    _handleGaugeFull(targetId) {
        if (this._hasStateTag(targetId, IsCooldown)) {
            // 帰還完了 -> コマンド選択待機へ
            this._applyStateTransition(targetId, PlayerStateType.READY_SELECT);
            
            // AI/入力待ちキューへの登録
            const stateEntity = this.world.createEntity();
            const actionRequeueState = new ActionRequeueState();
            actionRequeueState.isActive = true;
            actionRequeueState.entityId = targetId;
            this.world.addComponent(stateEntity, actionRequeueState);

        } else if (this._hasStateTag(targetId, IsCharging)) {
            // 充填完了 -> 行動実行待機へ
            this._applyStateTransition(targetId, PlayerStateType.READY_EXECUTE);
        }
    }

    _resetGauge(targetId, options = {}) {
        const gauge = this.world.getComponent(targetId, Gauge);
        if (!gauge) return;

        if (options.keepValue) {
            // 値を維持（または反転など）
            if (options.invert) {
                gauge.value = gauge.max - gauge.value;
            }
        } else {
            gauge.value = 0;
        }
        
        gauge.currentSpeed = 0;
        if (options.speedMultiplier !== undefined) {
            gauge.speedMultiplier = options.speedMultiplier;
        }
    }

    _clearAction(targetId) {
        this.world.addComponent(targetId, new Action());
    }

    _validateEntityAlive(targetId) {
        const parts = this.world.getComponent(targetId, Parts);
        if (!parts) return false;
        
        const headData = BattleQueries.getPartData(this.world, parts.head);
        return headData && !headData.isBroken;
    }

    // --- Request Processors ---

    _processGaugeFullTags() {
        const entities = this.getEntities(GaugeFullTag);
        for (const entityId of entities) {
            this._handleGaugeFull(entityId);
            this.world.removeComponent(entityId, GaugeFullTag);
        }
    }

    _processHandleGaugeFullRequests() {
        const entities = this.getEntities(HandleGaugeFullRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, HandleGaugeFullRequest);
            this._handleGaugeFull(request.targetId);
            this.world.destroyEntity(entityId);
        }
    }

    _processTransitionStateRequests() {
        const entities = this.getEntities(TransitionStateRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, TransitionStateRequest);
            this._applyStateTransition(request.targetId, request.newState);
            this.world.destroyEntity(entityId);
        }
    }

    _processResetToCooldownRequests() {
        const entities = this.getEntities(ResetToCooldownRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, ResetToCooldownRequest);
            const { targetId, options } = request;
            const { interrupted = false } = options;
            
            if (!this._validateEntityAlive(targetId)) {
                this.world.destroyEntity(entityId);
                continue;
            }

            // ガード解除
            if (this._hasStateTag(targetId, IsGuarding)) {
                const activeEffects = this.world.getComponent(targetId, ActiveEffects);
                if (activeEffects) {
                    activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
                }
            }
            
            // 状態とゲージを即時更新（同一フレーム内で行うことで揺れを防ぐ）
            this._applyStateTransition(targetId, PlayerStateType.CHARGING);
            
            // 中断時はゲージ反転、それ以外は0リセット
            this._resetGauge(targetId, { 
                keepValue: interrupted, 
                invert: interrupted,
                speedMultiplier: 1.0 
            });

            this._clearAction(targetId);
            this.world.destroyEntity(entityId);
        }
    }

    _processTransitionToCooldownRequests() {
        const entities = this.getEntities(TransitionToCooldownRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, TransitionToCooldownRequest);
            const { targetId } = request;

            if (!this._validateEntityAlive(targetId)) {
                this.world.destroyEntity(entityId);
                continue;
            }

            // ガード中はアクションのみクリアして終了
            if (this._hasStateTag(targetId, IsGuarding)) {
                this._clearAction(targetId);
                this.world.destroyEntity(entityId);
                continue;
            }

            // 次のクールダウン速度の計算
            let nextSpeedMultiplier = 1.0;
            const action = this.world.getComponent(targetId, Action);
            const parts = this.world.getComponent(targetId, Parts);

            if (action?.partKey && parts) {
                const partId = parts[action.partKey];
                const usedPart = BattleQueries.getPartData(this.world, partId);

                if (usedPart) {
                    const modifier = StatCalculator.getSpeedMultiplierModifier(this.world, targetId, usedPart);
                    nextSpeedMultiplier = CombatCalculator.calculateSpeedMultiplier({
                        might: usedPart.might,
                        success: usedPart.success,
                        factorType: 'cooldown',
                        modifier: modifier
                    });
                }
            }

            this._applyStateTransition(targetId, PlayerStateType.CHARGING);
            this._resetGauge(targetId, { speedMultiplier: nextSpeedMultiplier });
            this._clearAction(targetId);
            
            this.world.destroyEntity(entityId);
        }
    }

    _processSetPlayerBrokenRequests() {
        const entities = this.getEntities(SetPlayerBrokenRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, SetPlayerBrokenRequest);
            const { targetId } = request;
            
            this._applyStateTransition(targetId, PlayerStateType.BROKEN);
            this._clearAction(targetId);

            const playerInfo = this.world.getComponent(targetId, PlayerInfo);
            if (playerInfo) {
                const evt = this.world.createEntity();
                this.world.addComponent(evt, new PlayerBrokenEvent(targetId, playerInfo.teamId));
            }
            this.world.destroyEntity(entityId);
        }
    }
    
    _processSnapToActionLineRequests() {
        const entities = this.getEntities(SnapToActionLineRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, SnapToActionLineRequest);
            const { targetId } = request;
            
            const position = this.world.getComponent(targetId, Position);
            const playerInfo = this.world.getComponent(targetId, PlayerInfo);

            if (position && playerInfo) {
                position.x = playerInfo.teamId === TeamID.TEAM1
                    ? CONFIG.BATTLEFIELD.ACTION_LINE_TEAM1
                    : CONFIG.BATTLEFIELD.ACTION_LINE_TEAM2;
            }
            this.world.destroyEntity(entityId);
        }
    }
}