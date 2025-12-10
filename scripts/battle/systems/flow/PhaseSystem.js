/**
 * @file PhaseSystem.js
 * @description バトルフェーズのステートマシンを管理するシステム。
 * 各フェーズのロジックはStateクラスに委譲される。
 */
import { System } from '../../../../engine/core/System.js';
import { BattleContext } from '../../components/BattleContext.js';
import { GameEvents } from '../../../common/events.js';
import { IdleState } from './phases/IdleState.js';
import { GameOverState } from './phases/GameOverState.js';

export class PhaseSystem extends System {
    constructor(world) {
        super(world);
        this.battleContext = this.world.getSingletonComponent(BattleContext);
        
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