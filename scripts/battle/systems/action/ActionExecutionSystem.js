import { System } from '../../../../engine/core/System.js';
import { BattleContext } from '../../context/index.js';
import { Action, GameState, Parts } from '../../components/index.js';
import { BattlePhase, PlayerStateType, TargetTiming } from '../../../config/constants.js';
import { GameEvents } from '../../../common/events.js';
import { targetingStrategies } from '../../ai/targetingStrategies.js';
import { compareByPropulsion } from '../../utils/queryUtils.js';

export class ActionExecutionSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.executionQueue = [];
        this.isExecuting = false;
        this.currentExecutingActorId = null;

        this.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onAnimationCompleted.bind(this));
        this.on(GameEvents.COMBAT_RESOLUTION_DISPLAYED, this.onResolutionDisplayed.bind(this));
    }

    update(deltaTime) {
        if (this.battleContext.phase !== BattlePhase.ACTION_EXECUTION) {
            if (this.executionQueue.length > 0 || this.isExecuting) {
                this.executionQueue = [];
                this.isExecuting = false;
                this.currentExecutingActorId = null;
            }
            return;
        }

        if (this.executionQueue.length === 0 && !this.isExecuting) {
            this.populateExecutionQueueFromReady();
            if (this.executionQueue.length === 0) {
                this.world.emit(GameEvents.ACTION_EXECUTION_COMPLETED);
                return;
            }
        }

        if (!this.isExecuting && this.executionQueue.length > 0) {
            this.executeNextAction();
        }
    }
    
    populateExecutionQueueFromReady() {
        const readyEntities = this.getEntities(GameState).filter(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });

        readyEntities.sort(compareByPropulsion(this.world));
        
        this.executionQueue = readyEntities.map(id => {
            const action = this.world.getComponent(id, Action);
            return {
                entityId: id,
                partKey: action.partKey,
                targetId: action.targetId,
                targetPartKey: action.targetPartKey
            };
        });
    }

    executeNextAction() {
        const actionDetail = this.executionQueue.shift();
        if (!actionDetail) {
            this.isExecuting = false;
            return;
        }

        this.isExecuting = true;
        const { entityId } = actionDetail;
        this.currentExecutingActorId = entityId;
        
        const actionComp = this.world.getComponent(entityId, Action);
        Object.assign(actionComp, actionDetail);

        this.determinePostMoveTarget(entityId);

        const gameState = this.world.getComponent(entityId, GameState);
        if (gameState) gameState.state = PlayerStateType.AWAITING_ANIMATION;

        this.world.emit(GameEvents.EXECUTE_ATTACK_ANIMATION, {
            attackerId: entityId,
            targetId: actionComp.targetId
        });
    }

    onAnimationCompleted(detail) {
        if (this.isExecuting && this.currentExecutingActorId === detail.entityId) {
        }
    }

    onResolutionDisplayed(detail) {
        if (this.isExecuting && detail.attackerId === this.currentExecutingActorId) {
            this.world.emit(GameEvents.ACTION_COMPLETED, { entityId: this.currentExecutingActorId });
            this.isExecuting = false;
            this.currentExecutingActorId = null;
        }
    }
    
    determinePostMoveTarget(executorId) {
        const action = this.world.getComponent(executorId, Action);
        const parts = this.world.getComponent(executorId, Parts);
        const selectedPart = parts[action.partKey];

        if (selectedPart.targetTiming === TargetTiming.POST_MOVE && action.targetId === null) {
            const strategy = targetingStrategies[selectedPart.postMoveTargeting];
            if (strategy) {
                const targetData = strategy({ world: this.world, attackerId: executorId });
                if (targetData) {
                    action.targetId = targetData.targetId;
                    action.targetPartKey = targetData.targetPartKey;
                }
            }
        }
    }
}