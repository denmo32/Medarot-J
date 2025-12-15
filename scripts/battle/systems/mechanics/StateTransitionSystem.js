/**
 * @file StateTransitionSystem.js
 * @description 状態遷移リクエストを処理するシステム。
 * イベント発行をコンポーネント生成へ置換。GaugeSystemからのタグも直接処理する。
 */
import { System } from '../../../../engine/core/System.js';
import { GameState, Gauge, Action, ActiveEffects, Position } from '../../components/index.js';
import { Parts, PlayerInfo } from '../../../components/index.js';
import {
    TransitionStateRequest,
    ResetToCooldownRequest,
    HandleGaugeFullRequest, // 互換性のために残すが、基本はTag経由
    SetPlayerBrokenRequest,
    SnapToActionLineRequest,
    TransitionToCooldownRequest,
} from '../../components/CommandRequests.js';
import { 
    ActionRequeueRequest,
    PlayerBrokenEvent,
    GaugeFullTag
} from '../../components/Requests.js';
import { PlayerStateType, EffectType } from '../../common/constants.js';
import { TeamID } from '../../../common/constants.js';
import { CONFIG } from '../../common/config.js';
import { CombatCalculator } from '../../logic/CombatCalculator.js';
import { EffectService } from '../../services/EffectService.js';

const ACTIVE_GAUGE_STATES = new Set([
    PlayerStateType.CHARGING,
    PlayerStateType.SELECTED_CHARGING
]);

export class StateTransitionSystem extends System {
    constructor(world) {
        super(world);
    }

    update(deltaTime) {
        // Tag処理
        this._processGaugeFullTags();

        // Request処理
        this._processTransitionStateRequests();
        this._processResetToCooldownRequests();
        this._processHandleGaugeFullRequests(); // レガシーサポートまたは外部強制用
        this._processSetPlayerBrokenRequests();
        this._processSnapToActionLineRequests();
        this._processTransitionToCooldownRequests();
    }

    // --- Core Logic Implementations ---

    /**
     * ゲージ満タン時のロジック
     * GaugeFullTag または HandleGaugeFullRequest から呼ばれる
     */
    _handleGaugeFull(targetId) {
        const gameState = this.world.getComponent(targetId, GameState);
        if (!gameState) return;

        if (gameState.state === PlayerStateType.CHARGING) {
            // クールダウン完了 -> 行動選択準備完了
            this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.READY_SELECT));
            
            // ActionSelectionSystem が検知するためのリクエスト
            const req = this.world.createEntity();
            this.world.addComponent(req, new ActionRequeueRequest(targetId));

        } else if (gameState.state === PlayerStateType.SELECTED_CHARGING) {
            // チャージ完了 -> 行動実行準備完了
            this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.READY_EXECUTE));
        }
    }

    // --- Processors ---

    _processGaugeFullTags() {
        const entities = this.getEntities(GaugeFullTag);
        for (const entityId of entities) {
            // タグが付いているエンティティ自体が対象
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
            const { targetId, newState } = request;
            const gameState = this.world.getComponent(targetId, GameState);
            if (gameState) {
                gameState.state = newState;

                const gauge = this.world.getComponent(targetId, Gauge);
                if (gauge) {
                    gauge.isActive = ACTIVE_GAUGE_STATES.has(newState);
                    if (newState === PlayerStateType.BROKEN) {
                        gauge.value = 0;
                        gauge.currentSpeed = 0;
                    }
                }

                if (newState === PlayerStateType.GUARDING || newState === PlayerStateType.READY_EXECUTE) {
                    const reqEntity = this.world.createEntity();
                    this.world.addComponent(reqEntity, new SnapToActionLineRequest(targetId));
                }
            }
            this.world.destroyEntity(entityId);
        }
    }

    _processResetToCooldownRequests() {
        const entities = this.getEntities(ResetToCooldownRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, ResetToCooldownRequest);
            const { targetId, options } = request;
            const { interrupted = false } = options;
            const parts = this.world.getComponent(targetId, Parts);
            if (parts?.head?.isBroken) {
                this.world.destroyEntity(entityId);
                continue;
            }

            const gameState = this.world.getComponent(targetId, GameState);
            const gauge = this.world.getComponent(targetId, Gauge);

            if (gameState && gameState.state === PlayerStateType.GUARDING) {
                const activeEffects = this.world.getComponent(targetId, ActiveEffects);
                if (activeEffects) {
                    activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
                }
            }
            
            this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.CHARGING));

            if (gauge) {
                if (interrupted) {
                    gauge.value = gauge.max - gauge.value;
                } else {
                    gauge.value = 0;
                }
                gauge.currentSpeed = 0;
                gauge.speedMultiplier = 1.0;
            }

            this.world.addComponent(targetId, new Action());
            this.world.destroyEntity(entityId);
        }
    }

    _processSetPlayerBrokenRequests() {
        const entities = this.getEntities(SetPlayerBrokenRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, SetPlayerBrokenRequest);
            const { targetId } = request;
            
            this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.BROKEN));
            this.world.addComponent(targetId, new Action());

            // ログ用イベントコンポーネントを生成
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
    
    _processTransitionToCooldownRequests() {
        const entities = this.getEntities(TransitionToCooldownRequest);
        for (const entityId of entities) {
            const request = this.world.getComponent(entityId, TransitionToCooldownRequest);
            const { targetId } = request;

            const parts = this.world.getComponent(targetId, Parts);
            if (parts?.head?.isBroken) {
                this.world.destroyEntity(entityId);
                continue;
            }

            const gameState = this.world.getComponent(targetId, GameState);
            if (gameState && gameState.state === PlayerStateType.GUARDING) {
                this.world.addComponent(targetId, new Action());
                this.world.destroyEntity(entityId);
                continue;
            }

            const gauge = this.world.getComponent(targetId, Gauge);
            const action = this.world.getComponent(targetId, Action);

            if (action?.partKey && parts && gauge) {
                const usedPart = parts[action.partKey];
                if (usedPart) {
                    const modifier = EffectService.getSpeedMultiplierModifier(this.world, targetId, usedPart);
                    gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({
                        might: usedPart.might,
                        success: usedPart.success,
                        factorType: 'cooldown',
                        modifier: modifier
                    });
                }
            } else if (gauge) {
                gauge.speedMultiplier = 1.0;
            }

            this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.CHARGING));

            if (gauge) {
                gauge.value = 0;
                gauge.currentSpeed = 0;
            }

            this.world.addComponent(targetId, new Action());
            this.world.destroyEntity(entityId);
        }
    }
}