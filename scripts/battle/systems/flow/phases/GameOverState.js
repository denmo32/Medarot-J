/**
 * @file GameOverState.js
 * @description ゲームオーバーフェーズ。
 */
import { BaseState } from './BaseState.js';
import { BattlePhase, ModalType } from '../../../common/constants.js';
import { GameEvents } from '../../../../common/events.js';
import { Timer } from '../../../../../engine/stdlib/components/Timer.js';

export class GameOverState extends BaseState {
    constructor(system, winningTeam) {
        super(system);
        this.winningTeam = winningTeam;
    }

    enter() {
        this.battleContext.phase = BattlePhase.GAME_OVER;
        this.battleContext.winningTeam = this.winningTeam;

        // タイマーエンティティを作成してシーン遷移を予約
        // (UIのOKボタンでも遷移するが、自動遷移も残す)
        const timerEntity = this.world.createEntity();
        this.world.addComponent(timerEntity, new Timer(3000, () => {
            // 自動遷移はせず、クリックを待つ形にするならここは削除可。
            // 既存ロジックを踏襲して残すが、ユーザー入力を優先する場合はイベントハンドラ側で処理する。
        }));

        this.world.emit(GameEvents.SHOW_MODAL, { type: ModalType.GAME_OVER, data: { winningTeam: this.winningTeam } });
    }

    update(deltaTime) {
        // 状態遷移なし（シーン自体が破棄されるのを待つ）
        return null;
    }
}