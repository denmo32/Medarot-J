import { System } from '../../../../engine/core/System.js';
import { BattleContext } from '../../components/BattleContext.js';
import { GameState, Gauge, Action } from '../../components/index.js';
import { BattlePhase, PlayerStateType } from '../../common/constants.js';
import { GameEvents } from '../../../common/events.js';
import { PlayerStatusService } from '../../services/PlayerStatusService.js';

export class PhaseSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
        this.on(GameEvents.GAME_START_CONFIRMED, this.onGameStartConfirmed.bind(this));
        this.on(GameEvents.BATTLE_START_CONFIRMED, this.onBattleStartConfirmed.bind(this));
        this.on(GameEvents.BATTLE_START_CANCELLED, this.onBattleStartCancelled.bind(this));
        this.on('BATTLE_ANIMATION_COMPLETED', this.onBattleAnimationCompleted.bind(this));
        this.on(GameEvents.ACTION_SELECTION_COMPLETED, this.onActionSelectionCompleted.bind(this));
        this.on(GameEvents.ACTION_EXECUTION_COMPLETED, this.onActionExecutionCompleted.bind(this));
    }
    
    onGameStartConfirmed() {
        if (this.battleContext.phase !== BattlePhase.IDLE) return;
        this._startInitialSelection();
    }

    onBattleStartCancelled() {
        this.battleContext.isPaused = false;
        this.world.emit(GameEvents.HIDE_MODAL);
        this._startInitialSelection();
    }

    onBattleStartConfirmed() {
        this.battleContext.isPaused = false;
        this.battleContext.phase = BattlePhase.BATTLE_START;
        this.world.emit(GameEvents.HIDE_MODAL);
        this.world.emit(GameEvents.SHOW_BATTLE_START_ANIMATION);
    }
    
    _startInitialSelection() {
        this.battleContext.phase = BattlePhase.INITIAL_SELECTION;

        const players = this.getEntities(GameState, Gauge);
        players.forEach(id => {
            const gameState = this.world.getComponent(id, GameState);
            const gauge = this.world.getComponent(id, Gauge);
            
            if (gauge) gauge.value = 0;

            if (gameState.state !== PlayerStateType.BROKEN) {
                PlayerStatusService.transitionTo(this.world, id, PlayerStateType.READY_SELECT);
                
                gauge.value = gauge.max;
                gauge.speedMultiplier = 1.0;
                this.world.addComponent(id, new Action());
                this.world.emit(GameEvents.ACTION_QUEUE_REQUEST, { entityId: id });
            }
        });
    }

    onBattleAnimationCompleted() {
        if (this.battleContext.phase === BattlePhase.BATTLE_START) {
            this.getEntities(GameState).forEach(id => {
                const gauge = this.world.getComponent(id, 'Gauge');
                if (gauge) gauge.value = 0;
            });
            this.battleContext.phase = BattlePhase.TURN_START;
        }
    }

    onActionSelectionCompleted() {
        // アクション選択完了 -> 即実行フェーズへ移行するか判定
        if (this.battleContext.phase !== BattlePhase.ACTION_SELECTION) return;
        
        if (this.isAnyEntityInCharging()) {
             if (this.isAnyEntityReadyToExecute()) {
                this.battleContext.phase = BattlePhase.ACTION_EXECUTION;
                // REQUESTED イベントの発行は不要になる (SequenceSystemがPhaseを監視するため)
             }
        } else {
             this.battleContext.phase = BattlePhase.TURN_END;
        }
    }

    onActionExecutionCompleted() {
        if (this.battleContext.phase !== BattlePhase.ACTION_EXECUTION) return;

        if (this.isAnyEntityInCharging()) {
            this.battleContext.phase = BattlePhase.ACTION_SELECTION;
        } else {
            this.battleContext.phase = BattlePhase.TURN_END;
        }
    }

    update(deltaTime) {
        if (!this.battleContext) return;

        // フェーズ遷移の監視
        if (this.battleContext.phase === BattlePhase.TURN_START || 
            this.battleContext.phase === BattlePhase.ACTION_SELECTION || 
            this.battleContext.phase === BattlePhase.TURN_END) {
            
            if (this.isAnyEntityReadyToExecute()) {
                this.battleContext.phase = BattlePhase.ACTION_EXECUTION;
                // SequenceSystemがこれを見て起動する
                return;
            }
        }

        switch (this.battleContext.phase) {
            case BattlePhase.INITIAL_SELECTION:
                this.checkInitialSelectionComplete();
                break;
            
            case 'BATTLE_START_CONFIRM':
                this.handleBattleStartConfirm();
                break;

            case BattlePhase.TURN_START:
                this.battleContext.phase = BattlePhase.ACTION_SELECTION;
                break;
            
            case BattlePhase.TURN_END:
                this.battleContext.turn.number++;
                this.world.emit(GameEvents.TURN_END, { turnNumber: this.battleContext.turn.number - 1 });
                
                this.battleContext.phase = BattlePhase.TURN_START;
                this.world.emit(GameEvents.TURN_START, { turnNumber: this.battleContext.turn.number });
                break;
        }
    }
    
    checkInitialSelectionComplete() {
        const allPlayers = this.getEntities(GameState);
        if (allPlayers.length === 0) return;

        const allSelected = allPlayers.every(id => {
            const state = this.world.getComponent(id, GameState);
            const unselectedStates = [PlayerStateType.READY_SELECT, PlayerStateType.COOLDOWN_COMPLETE];
            return !unselectedStates.includes(state.state);
        });

        if (allSelected) {
            this.battleContext.phase = 'BATTLE_START_CONFIRM';
        }
    }
    
    handleBattleStartConfirm() {
        if (!this.battleContext.isPaused) {
            this.world.emit(GameEvents.SHOW_MODAL, { 
                type: 'battle_start_confirm',
                data: {},
                priority: 'high'
            });
            this.battleContext.isPaused = true; 
        }
    }
    
    isAnyEntityReadyToExecute() {
        const entities = this.getEntities(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });
    }

    isAnyEntityInCharging() {
        const entities = this.getEntities(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.CHARGING || state.state === PlayerStateType.SELECTED_CHARGING;
        });
    }
}