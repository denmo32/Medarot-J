/**
 * @file PhaseSystem.js
 * @description バトルフェーズのステートマシンを管理するシステム。
 * 各フェーズのロジックはStateクラスに委譲される。
 */
import { System } from '../../../../engine/core/System.js';
import { PhaseContext } from '../../components/PhaseContext.js';
import { BattleStateContext } from '../../components/BattleStateContext.js'; // winningTeam用
import { TurnContext } from '../../components/TurnContext.js'; // 追加
import { GameEvents } from '../../../common/events.js';
import { IdleState } from './phases/IdleState.js';
import { GameOverState } from './phases/GameOverState.js';

export class PhaseSystem extends System {
    constructor(world) {
        super(world);
        this.phaseContext = this.world.getSingletonComponent(PhaseContext);
        this.battleStateContext = this.world.getSingletonComponent(BattleStateContext); // winningTeam用
        this.turnContext = this.world.getSingletonComponent(TurnContext); // 追加

        // 初期ステート
        this.currentState = new IdleState(this);
        this.currentState.enter();

        // 外部からの強制的なステート変更要求（ゲームオーバーなど）を受け付ける
        this.on(GameEvents.GAME_OVER, this.onGameOver.bind(this));
    }

    update(deltaTime) {
        if (!this.currentState) return;

        const nextState = this.currentState.update(deltaTime);

        if (nextState) {
            this.changeState(nextState);
        }
    }

    changeState(newState) {
        if (this.currentState) {
            this.currentState.exit();
        }
        this.currentState = newState;
        this.currentState.enter();
    }

    onGameOver(detail) {
        // 既にゲームオーバーなら何もしない
        if (this.currentState instanceof GameOverState) return;

        this.changeState(new GameOverState(this, detail.winningTeam));
    }
}