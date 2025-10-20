/**
 * @file PhaseSystem.js (新規作成)
 * @description バトル全体のフェーズ遷移を管理するシステム。
 * BattleContextのphaseプロパティを監視し、条件に応じて次のフェーズへ移行させる責務を持つ。
 * これにより、複雑なイベント駆動のフローを、状態に基づいた明確な遷移ロジックに置き換える。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { BattleContext } from '../core/index.js';
import { GameState, PlayerInfo, Action } from '../core/components/index.js';
import { BattlePhase, PlayerStateType } from '../common/constants.js';
import { GameEvents } from '../common/events.js';
import { TurnSystem } from './turnSystem.js';
import { ActionSelectionSystem } from './ActionSelectionSystem.js';
import { ActionExecutionSystem } from './ActionExecutionSystem.js';

export class PhaseSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        this.world.on('BATTLE_ANIMATION_COMPLETED', this.onBattleAnimationCompleted.bind(this));
    }

    update(deltaTime) {
        if (!this.battleContext) return;

        // [追加] READY_EXECUTE状態の機体をチェックし、実行フェーズに移行するロジック
        // このチェックは、主要なゲージ進行フェーズで行う
        const activePhases = [BattlePhase.TURN_START, BattlePhase.ACTION_SELECTION, BattlePhase.TURN_END];
        if (activePhases.includes(this.battleContext.phase)) {
            if (this.isAnyEntityReadyToExecute()) {
                this.battleContext.phase = BattlePhase.ACTION_EXECUTION;
                return; // フェーズが変更されたので、このフレームの以降のswitch処理はスキップ
            }
        }

        switch (this.battleContext.phase) {
            case BattlePhase.INITIAL_SELECTION:
                this.checkInitialSelectionComplete();
                break;
            
            case 'BATTLE_START_CONFIRM':
                this.handleBattleStartConfirm();
                break;

            case BattlePhase.BATTLE_START:
                break;

            case BattlePhase.TURN_START:
                this.battleContext.phase = BattlePhase.ACTION_SELECTION;
                break;

            case BattlePhase.ACTION_SELECTION:
                this.checkActionSelectionComplete();
                break;
            
            case BattlePhase.ACTION_EXECUTION:
                if (this.isExecutionFinished()) {
                    this.battleContext.phase = BattlePhase.ACTION_RESOLUTION;
                }
                break;
            
            case BattlePhase.ACTION_RESOLUTION:
                if (this.isResolutionFinished()) {
                    this.battleContext.phase = BattlePhase.TURN_END;
                }
                break;

            case BattlePhase.TURN_END:
                this.battleContext.turn.number++;
                this.battleContext.phase = BattlePhase.TURN_START;
                this.world.emit(GameEvents.TURN_END, { turnNumber: this.battleContext.turn.number - 1 });
                this.world.emit(GameEvents.TURN_START, { turnNumber: this.battleContext.turn.number });
                break;
        }
    }
    
    onBattleAnimationCompleted() {
        if (this.battleContext.phase === BattlePhase.BATTLE_START) {
            this.world.getEntitiesWith(GameState).forEach(id => {
                const gauge = this.world.getComponent(id, 'Gauge');
                if (gauge) gauge.value = 0;
            });
            this.battleContext.phase = BattlePhase.TURN_START;
        }
    }

    checkInitialSelectionComplete() {
        const allPlayers = this.world.getEntitiesWith(GameState);
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
    
    checkActionSelectionComplete() {
        const turnSystem = this.world.systems.find(s => s instanceof TurnSystem);
        const actionSelectionSystem = this.world.systems.find(s => s instanceof ActionSelectionSystem);

        if (turnSystem && actionSelectionSystem &&
            turnSystem.actionQueue.length === 0 &&
            actionSelectionSystem.battleContext.turn.currentActorId === null) 
        {
            // [修正] 全員の選択が終わったら、あとはREADY_EXECUTE待ちなので、何もしない。
            // ターンエンドの判定は、READY_EXECUTEが誰もいない状況で行う。
            if (this.battleContext.turn.selectedActions.size === 0 && !this.isAnyEntityReadyToExecute() && !this.isAnyEntityInCharging()) {
                 this.battleContext.phase = BattlePhase.TURN_END;
            }
        }
    }

    isExecutionFinished() {
        const execSystem = this.world.systems.find(s => s instanceof ActionExecutionSystem);
        return execSystem && !execSystem.isExecuting && execSystem.executionQueue.length === 0;
    }
    
    isResolutionFinished() {
        return this.battleContext.turn.resolvedActions.length === 0;
    }
    
    /**
     * [追加] 1機でも行動実行準備完了状態の機体がいるかチェックする
     */
    isAnyEntityReadyToExecute() {
        const entities = this.world.getEntitiesWith(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });
    }

    /**
     * [追加] 誰か一人でもチャージ中の機体がいるかチェックする（ターンエンド判定用）
     */
    isAnyEntityInCharging() {
        const entities = this.world.getEntitiesWith(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.CHARGING || state.state === PlayerStateType.SELECTED_CHARGING;
        });
    }
}