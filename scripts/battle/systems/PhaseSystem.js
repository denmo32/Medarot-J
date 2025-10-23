/**
 * @file PhaseSystem.js
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
        
        // フェーズ完了イベントを購読し、フェーズ遷移を管理
        this.world.on(GameEvents.ACTION_SELECTION_COMPLETED, this.onActionSelectionCompleted.bind(this));
        this.world.on(GameEvents.ACTION_EXECUTION_COMPLETED, this.onActionExecutionCompleted.bind(this));
        // ACTION_RESOLUTION_COMPLETED イベントは廃止されたため、購読を停止
    }
    
    // --- イベントハンドラ ---

    onBattleAnimationCompleted() {
        if (this.battleContext.phase === BattlePhase.BATTLE_START) {
            this.world.getEntitiesWith(GameState).forEach(id => {
                const gauge = this.world.getComponent(id, 'Gauge');
                if (gauge) gauge.value = 0;
            });
            this.battleContext.phase = BattlePhase.TURN_START;
        }
    }

    /** 行動選択完了イベントを受け、実行フェーズに移行するか判断 */
    onActionSelectionCompleted() {
        if (this.battleContext.phase !== BattlePhase.ACTION_SELECTION) return;
        
        // 誰か一人でもチャージ中の機体がいれば、ターンはまだ終わらない
        if (this.isAnyEntityInCharging()) {
            // READY_EXECUTE状態の機体がいれば実行フェーズへ、いなければゲージ進行に戻る
             if (this.isAnyEntityReadyToExecute()) {
                this.battleContext.phase = BattlePhase.ACTION_EXECUTION;
             } else {
                // 実行対象がいないが、まだチャージ中の機体がいる場合はターン続行（ゲージ進行）
                // フェーズは変えずに、各システムが自身のupdateで処理を続ける
             }
        } else {
             // 選択も完了し、誰もチャージしていない場合はターン終了
             this.battleContext.phase = BattlePhase.TURN_END;
        }
    }

    /**
     * 行動実行完了イベントを受け、解決フェーズをスキップしてターン継続/終了の判断を行う
     */
    onActionExecutionCompleted() {
        if (this.battleContext.phase !== BattlePhase.ACTION_EXECUTION) return;

        // まだ行動待ち（チャージ中）のエンティティがいるかチェック
        if (this.isAnyEntityInCharging()) {
            // いる場合: ゲージ進行と次の行動選択を待つため、ACTION_SELECTIONフェーズに戻る
            this.battleContext.phase = BattlePhase.ACTION_SELECTION;
        } else {
            // いない場合: 全員の行動が完了したので、ターン終了フェーズへ
            this.battleContext.phase = BattlePhase.TURN_END;
        }
    }

    update(deltaTime) {
        if (!this.battleContext) return;

        // ゲージ進行フェーズ中、READY_EXECUTE状態の機体が現れたら即座に実行フェーズへ移行
        const activePhases = [BattlePhase.TURN_START, BattlePhase.ACTION_SELECTION, BattlePhase.TURN_END];
        if (activePhases.includes(this.battleContext.phase)) {
            if (this.isAnyEntityReadyToExecute()) {
                this.battleContext.phase = BattlePhase.ACTION_EXECUTION;
                return; // フェーズが変更されたので、このフレームの以降のswitch処理はスキップ
            }
        }

        switch (this.battleContext.phase) {
            case BattlePhase.INITIAL_SELECTION:
                // 初期選択の完了チェック（これは特殊なケースなので残す）
                this.checkInitialSelectionComplete();
                break;
            
            case 'BATTLE_START_CONFIRM':
                this.handleBattleStartConfirm();
                break;

            case BattlePhase.BATTLE_START:
                // アニメーション完了イベント待ち
                break;

            case BattlePhase.TURN_START:
                // 即座に行動選択フェーズへ
                this.battleContext.phase = BattlePhase.ACTION_SELECTION;
                break;

            case BattlePhase.ACTION_SELECTION:
            case BattlePhase.ACTION_EXECUTION:
                // これらのフェーズの完了はイベント駆動で処理されるため、updateでのチェックは不要
                break;
            
            case BattlePhase.TURN_END:
                // ターン終了処理を行い、次のターンへ
                this.battleContext.turn.number++;
                this.world.emit(GameEvents.TURN_END, { turnNumber: this.battleContext.turn.number - 1 });
                
                this.battleContext.phase = BattlePhase.TURN_START;
                this.world.emit(GameEvents.TURN_START, { turnNumber: this.battleContext.turn.number });
                break;
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
    
    /**
     * 1機でも行動実行準備完了状態の機体がいるかチェックする
     */
    isAnyEntityReadyToExecute() {
        const entities = this.world.getEntitiesWith(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });
    }

    /**
     * 誰か一人でもチャージ中の機体がいるかチェックする（ターンエンド判定用）
     */
    isAnyEntityInCharging() {
        const entities = this.world.getEntitiesWith(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.CHARGING || state.state === PlayerStateType.SELECTED_CHARGING;
        });
    }
}