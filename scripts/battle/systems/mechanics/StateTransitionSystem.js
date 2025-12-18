/**
 * @file StateTransitionSystem.js
 * @description 状態遷移リクエスト処理システム。
 * クールダウン計算時のパーツデータ参照を修正。
 */
import { System } from '../../../../engine/core/System.js';
import { 
    Gauge, Action, ActiveEffects, Position,
    IsReadyToSelect, IsReadyToExecute, IsCharging, IsCooldown, 
    IsGuarding, IsBroken, IsAwaitingAnimation
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
import { EffectService } from '../../services/EffectService.js';
import { QueryService } from '../../services/QueryService.js';

export class StateTransitionSystem extends System {
    constructor(world) {
        super(world);
        this.stateTags = [
            IsReadyToSelect, IsReadyToExecute, IsCharging, IsCooldown, 
            IsGuarding, IsBroken, IsAwaitingAnimation
        ];
    }

    update(deltaTime) {
        this._processGaugeFullTags();
        this._processTransitionStateRequests();
        this._processResetToCooldownRequests();
        this._processHandleGaugeFullRequests();
        this._processSetPlayerBrokenRequests();
        this._processSnapToActionLineRequests();
        this._processTransitionToCooldownRequests();
    }

    _clearStateTags(entityId) {
        this.stateTags.forEach(Tag => this.world.removeComponent(entityId, Tag));
    }

    _setStateTag(entityId, newState) {
        this._clearStateTags(entityId);
        
        switch (newState) {
            case PlayerStateType.READY_SELECT:
                this.world.addComponent(entityId, new IsReadyToSelect());
                break;
            case PlayerStateType.READY_EXECUTE:
                this.world.addComponent(entityId, new IsReadyToExecute());
                break;
            case PlayerStateType.SELECTED_CHARGING:
                this.world.addComponent(entityId, new IsCharging());
                break;
            case PlayerStateType.CHARGING:
                this.world.addComponent(entityId, new IsCooldown());
                break;
            case PlayerStateType.GUARDING:
                this.world.addComponent(entityId, new IsGuarding());
                break;
            case PlayerStateType.BROKEN:
                this.world.addComponent(entityId, new IsBroken());
                break;
            case PlayerStateType.AWAITING_ANIMATION:
                this.world.addComponent(entityId, new IsAwaitingAnimation());
                break;
        }
    }

    _hasStateTag(entityId, TagClass) {
        return this.world.getComponent(entityId, TagClass) !== null;
    }

    _handleGaugeFull(targetId) {
        if (this._hasStateTag(targetId, IsCooldown)) {
            this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.READY_SELECT));
            
            const stateEntity = this.world.createEntity();
            const actionRequeueState = new ActionRequeueState();
            actionRequeueState.isActive = true;
            actionRequeueState.entityId = targetId;
            this.world.addComponent(stateEntity, actionRequeueState);

        } else if (this._hasStateTag(targetId, IsCharging)) {
            this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.READY_EXECUTE));
        }
    }

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
            const { targetId, newState } = request;
            
            this._setStateTag(targetId, newState);

            const gauge = this.world.getComponent(targetId, Gauge);
            if (gauge) {
                const isActive = newState === PlayerStateType.SELECTED_CHARGING || 
                                 newState === PlayerStateType.CHARGING;
                gauge.isActive = isActive;
                
                if (newState === PlayerStateType.BROKEN) {
                    gauge.value = 0;
                    gauge.currentSpeed = 0;
                }
            }

            if (newState === PlayerStateType.GUARDING || newState === PlayerStateType.READY_EXECUTE) {
                const reqEntity = this.world.createEntity();
                this.world.addComponent(reqEntity, new SnapToActionLineRequest(targetId));
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
            if (!parts) {
                this.world.destroyEntity(entityId);
                continue;
            }
            const headData = QueryService.getPartData(this.world, parts.head);

            if (!headData || headData.isBroken) {
                this.world.destroyEntity(entityId);
                continue;
            }

            if (this._hasStateTag(targetId, IsGuarding)) {
                const activeEffects = this.world.getComponent(targetId, ActiveEffects);
                if (activeEffects) {
                    activeEffects.effects = activeEffects.effects.filter(e => e.type !== EffectType.APPLY_GUARD);
                }
            }
            
            this.world.addComponent(this.world.createEntity(), new TransitionStateRequest(targetId, PlayerStateType.CHARGING));

            const gauge = this.world.getComponent(targetId, Gauge);
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
            if (!parts) {
                this.world.destroyEntity(entityId);
                continue;
            }
            const headData = QueryService.getPartData(this.world, parts.head);

            if (!headData || headData.isBroken) {
                this.world.destroyEntity(entityId);
                continue;
            }

            if (this._hasStateTag(targetId, IsGuarding)) {
                this.world.addComponent(targetId, new Action());
                this.world.destroyEntity(entityId);
                continue;
            }

            const gauge = this.world.getComponent(targetId, Gauge);
            const action = this.world.getComponent(targetId, Action);

            if (action?.partKey && parts && gauge) {
                const partId = parts[action.partKey];
                const usedPart = QueryService.getPartData(this.world, partId);

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