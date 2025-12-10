/**
 * @file ActionSelectionState.js
 * @description アクション選択フェーズ（チャージ、コマンド選択待機）。
 */
import { BaseState } from './BaseState.js';
import { BattlePhase, PlayerStateType } from '../../../common/constants.js';
import { GameState } from '../../../components/index.js';
import { ActionExecutionState } from './ActionExecutionState.js';
import { TurnEndState } from './TurnEndState.js';
import { GameEvents } from '../../../../common/events.js';

export class ActionSelectionState extends BaseState {
    enter() {
        this.battleContext.phase = BattlePhase.ACTION_SELECTION;
        // ActionSelectionSystemがこのフェーズ中に動作する
    }

    update(deltaTime) {
        // 1. 実行待機状態のエンティティがいるかチェック
        if (this._isAnyEntityReadyToExecute()) {
            return new ActionExecutionState(this.system);
        }

        // 2. 誰もチャージ中でなく、誰も選択中でない場合、ターン終了へ
        // （全員行動済み、または全員破壊された場合など）
        if (!this._isAnyEntityInAction()) {
            return new TurnEndState(this.system);
        }

        return null;
    }

    _isAnyEntityReadyToExecute() {
        const entities = this.system.getEntities(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });
    }

    _isAnyEntityInAction() {
        const entities = this.system.getEntities(GameState);
        return entities.some(id => {
            const state = this.world.getComponent(id, GameState);
            // チャージ中、選択待機中、選択決定後チャージ中
            return state.state === PlayerStateType.CHARGING || 
                   state.state === PlayerStateType.READY_SELECT ||
                   state.state === PlayerStateType.SELECTED_CHARGING;
        });
    }
}