/**
 * @file ActionExecutionState.js
 * @description アクション実行フェーズ。
 */
import { BaseState } from './BaseState.js';
import { BattlePhase, PlayerStateType } from '../../../common/constants.js';
import { GameState } from '../../../components/index.js';
import { ActionSelectionState } from './ActionSelectionState.js';
import { TurnEndState } from './TurnEndState.js';
import { GameEvents } from '../../../../common/events.js';

export class ActionExecutionState extends BaseState {
    constructor(system) {
        super(system);
        this._isSequenceCompleted = false;
        this._onSequenceCompleted = this._onSequenceCompleted.bind(this);
    }

    enter() {
        this.battleContext.phase = BattlePhase.ACTION_EXECUTION;
        // BattleSequenceSystemがこのフェーズを監視して起動する
        // 完了イベントをリッスンする
        this.world.on(GameEvents.ACTION_EXECUTION_COMPLETED, this._onSequenceCompleted);
    }

    update(deltaTime) {
        if (this._isSequenceCompleted) {
            // アクション実行が終わったら、まだ行動中の機体がいれば選択フェーズに戻る
            // いなければターン終了へ
            if (this._isAnyEntityInAction()) {
                return new ActionSelectionState(this.system);
            } else {
                return new TurnEndState(this.system);
            }
        }
        return null;
    }

    exit() {
        this.world.off(GameEvents.ACTION_EXECUTION_COMPLETED, this._onSequenceCompleted);
    }

    _onSequenceCompleted() {
        this._isSequenceCompleted = true;
    }

    _isAnyEntityInAction() {
        const entities = this.system.getEntities(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.CHARGING || 
                   state.state === PlayerStateType.READY_SELECT ||
                   state.state === PlayerStateType.SELECTED_CHARGING;
        });
    }
}