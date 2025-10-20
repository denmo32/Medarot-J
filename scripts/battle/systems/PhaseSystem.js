/**
 * @file PhaseSystem.js (新規作成)
 * @description バトル全体のフェーズ遷移を管理するシステム。
 * BattleContextのphaseプロパティを監視し、条件に応じて次のフェーズへ移行させる責務を持つ。
 * これにより、複雑なイベント駆動のフローを、状態に基づいた明確な遷移ロジックに置き換える。
 */
import { BaseSystem } from '../../core/baseSystem.js';
import { BattleContext } from '../core/index.js';
import { GameState, PlayerInfo } from '../core/components/index.js';
import { BattlePhase, PlayerStateType } from '../common/constants.js';
import { GameEvents } from '../common/events.js';
// [追加] TurnSystemクラスをインポート
import { TurnSystem } from './turnSystem.js';

export class PhaseSystem extends BaseSystem {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);

        // [追加] BATTLE_ANIMATION_COMPLETEDイベントの購読をこちらに移動
        this.world.on('BATTLE_ANIMATION_COMPLETED', this.onBattleAnimationCompleted.bind(this));
    }

    update(deltaTime) {
        if (!this.battleContext) return;

        switch (this.battleContext.phase) {
            case BattlePhase.INITIAL_SELECTION:
                this.checkInitialSelectionComplete();
                break;
            
            case 'BATTLE_START_CONFIRM':
                this.handleBattleStartConfirm();
                break;

            case BattlePhase.BATTLE_START:
                // このフェーズはアニメーション再生中。完了はイベントハンドラで検知する。
                break;

            case BattlePhase.TURN_START:
                this.battleContext.phase = BattlePhase.ACTION_SELECTION;
                break;

            case BattlePhase.ACTION_SELECTION:
                this.checkActionSelectionComplete();
                break;
            
            case BattlePhase.TURN_END:
                this.battleContext.turn.number++;
                this.battleContext.phase = BattlePhase.TURN_START;
                this.world.emit(GameEvents.TURN_END, { turnNumber: this.battleContext.turn.number - 1 });
                this.world.emit(GameEvents.TURN_START, { turnNumber: this.battleContext.turn.number });
                break;
        }
    }
    
    /**
     * [追加] 戦闘開始アニメーション完了時のハンドラ
     */
    onBattleAnimationCompleted() {
        if (this.battleContext.phase === BattlePhase.BATTLE_START) {
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
        const entities = this.world.getEntitiesWith(GameState, PlayerInfo);
        const hasReadyToExecute = entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });

        // [修正] `this.world.systems`からTurnSystemのインスタンスを正しく見つける
        const turnSystem = this.world.systems.find(s => s instanceof TurnSystem);
        if (!hasReadyToExecute && turnSystem && turnSystem.actionQueue.length === 0) {
            this.battleContext.phase = BattlePhase.TURN_END;
        }
    }
}