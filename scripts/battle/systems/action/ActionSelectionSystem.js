import { System } from '../../../../engine/core/System.js';
import { BattleContext } from '../../context/index.js';
import { BattlePhase, PlayerStateType } from '../../common/constants.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { Action, GameState, Gauge } from '../../components/index.js';
import { CombatCalculator } from '../../utils/combatFormulas.js';
import { PlayerStatusService } from '../../services/PlayerStatusService.js';

/**
 * @class ActionSelectionSystem
 * @description アクションの選択フェーズを管理します。
 */
export class ActionSelectionSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.on(GameEvents.ACTION_SELECTED, this.onActionSelected.bind(this));
        this.on(GameEvents.NEXT_ACTOR_DETERMINED, this.onNextActorDetermined.bind(this));
    }

    update(deltaTime) {
        const activePhases = [
            BattlePhase.ACTION_SELECTION,
            BattlePhase.INITIAL_SELECTION 
        ];
        if (!activePhases.includes(this.battleContext.phase)) {
            return;
        }

        // 行動選択中のアクターがおらず、キューも空の場合、選択フェーズ終了を通知
        if (this.battleContext.turn.currentActorId === null && this.battleContext.turn.actionQueue.length === 0) {
            if (this.battleContext.phase === BattlePhase.ACTION_SELECTION) {
                this.world.emit(GameEvents.ACTION_SELECTION_COMPLETED);
            }
        }
    }

    onNextActorDetermined(detail) {
        const { entityId } = detail;
        this.battleContext.turn.currentActorId = entityId;
        this.triggerActionSelection(entityId);
    }

    triggerActionSelection(entityId) {
        const playerInfo = this.world.getComponent(entityId, PlayerInfo);
        const eventToEmit = playerInfo.teamId === 'team1' 
            ? GameEvents.PLAYER_INPUT_REQUIRED 
            : GameEvents.AI_ACTION_REQUIRED;
            
        this.world.emit(eventToEmit, { entityId });
    }

    /**
     * アクションが選択された時の処理
     */
    onActionSelected(detail) {
        const { entityId, partKey, targetId, targetPartKey } = detail;

        // 現在のアクターと一致するか確認
        if (this.battleContext.turn.currentActorId === entityId) {
            this.battleContext.turn.selectedActions.set(entityId, detail);
            this.battleContext.turn.currentActorId = null;
        }

        // コンポーネントの更新とチャージ開始
        const action = this.world.getComponent(entityId, Action);
        const parts = this.world.getComponent(entityId, Parts);
        const gauge = this.world.getComponent(entityId, Gauge);

        if (!partKey || !parts?.[partKey] || parts[partKey].isBroken) {
            console.warn(`ActionSelectionSystem: Invalid or broken part selected for entity ${entityId}. Re-queueing.`, detail);
            this.world.emit(GameEvents.ACTION_REQUEUE_REQUEST, { entityId });
            return;
        }

        const selectedPart = parts[partKey];

        // アクション情報を更新
        action.partKey = partKey;
        action.type = selectedPart.action;
        action.targetId = targetId;
        action.targetPartKey = targetPartKey;
        action.targetTiming = selectedPart.targetTiming;

        // 状態をチャージ中に更新 (Service使用)
        PlayerStatusService.transitionTo(this.world, entityId, PlayerStateType.SELECTED_CHARGING);
        
        // ゲージをリセットして速度を設定
        gauge.value = 0;
        gauge.currentSpeed = 0;
        gauge.speedMultiplier = CombatCalculator.calculateSpeedMultiplier({ part: selectedPart, factorType: 'charge' });
    }
}