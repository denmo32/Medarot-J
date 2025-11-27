import { System } from '../../../../engine/core/System.js';
import { GameEvents } from '../../../common/events.js';
import { ModalType } from '../../common/constants.js';

const SequenceState = {
    IDLE: 'IDLE',
    ANIMATING: 'ANIMATING',
    RESOLVING: 'RESOLVING',
    DISPLAYING: 'DISPLAYING',
    COOLDOWN: 'COOLDOWN'
};

/**
 * @class BattleSequenceSystem
 * @description アクション実行の一連の流れ（シーケンス）を制御するシステム。
 * Execution -> Resolution -> Display -> Cooldown の遷移を一元管理する。
 */
export class BattleSequenceSystem extends System {
    constructor(world) {
        super(world);
        this.currentState = SequenceState.IDLE;
        this.currentActorId = null;

        // イベントバインディング
        this.on(GameEvents.REQUEST_ACTION_SEQUENCE_START, this.onSequenceStart.bind(this));
        this.on(GameEvents.EXECUTION_ANIMATION_COMPLETED, this.onAnimationCompleted.bind(this));
        this.on(GameEvents.ACTION_RESOLUTION_COMPLETED, this.onResolutionCompleted.bind(this));
        this.on(GameEvents.MODAL_CLOSED, this.onModalClosed.bind(this));
        this.on(GameEvents.COOLDOWN_TRANSITION_COMPLETED, this.onCooldownCompleted.bind(this));
    }

    /**
     * アクションシーケンス開始
     * ActionExecutionSystem から呼ばれる
     */
    onSequenceStart(detail) {
        if (this.currentState !== SequenceState.IDLE) {
            console.warn(`BattleSequenceSystem: Busy. State=${this.currentState}`);
            return;
        }

        this.currentActorId = detail.entityId;
        this.currentState = SequenceState.ANIMATING;

        // アクション実行アニメーションの開始を要求
        this.world.emit(GameEvents.REQUEST_EXECUTION_ANIMATION, { entityId: this.currentActorId });
    }

    /**
     * アニメーション完了
     * ActionExecutionSystem (経由の ViewSystem) から通知
     */
    onAnimationCompleted(detail) {
        if (this.currentState !== SequenceState.ANIMATING || detail.entityId !== this.currentActorId) {
            return;
        }

        this.currentState = SequenceState.RESOLVING;

        // アクション解決（計算）を要求
        this.world.emit(GameEvents.REQUEST_ACTION_RESOLUTION, { entityId: this.currentActorId });
    }

    /**
     * アクション解決完了
     * ActionResolutionSystem から通知
     */
    onResolutionCompleted(detail) {
        if (this.currentState !== SequenceState.RESOLVING) {
            return;
        }

        const { resultData } = detail;
        
        // 結果表示フェーズへ移行
        this.currentState = SequenceState.DISPLAYING;

        // 結果表示を要求 (MessageSystemへ)
        this.world.emit(GameEvents.REQUEST_RESULT_DISPLAY, { resultData });
    }

    /**
     * モーダルが閉じられたイベント
     * MessageSystem -> ActionPanelSystem から通知される MODAL_CLOSED を監視し、
     * 表示シーケンスの終了を判定する。
     */
    onModalClosed(detail) {
        if (this.currentState !== SequenceState.DISPLAYING) return;

        // 結果表示に関連するモーダルが閉じられたかチェック
        // 通常、攻撃宣言(ATTACK_DECLARATION)または結果(EXECUTION_RESULT)が最後に閉じられる
        const targetModalTypes = [ModalType.EXECUTION_RESULT, ModalType.ATTACK_DECLARATION];
        
        if (targetModalTypes.includes(detail.modalType)) {
            // ここでは簡易的に、対象モーダルが閉じられたらシーケンス終了とみなしてクールダウンへ進む。
            // ※ActionPanelSystemのキューイング仕様により、最後のモーダルが閉じられたタイミングとなる。
            this._proceedToCooldown();
        }
    }

    _proceedToCooldown() {
        this.currentState = SequenceState.COOLDOWN;
        this.world.emit(GameEvents.REQUEST_COOLDOWN_TRANSITION, { entityId: this.currentActorId });
    }

    /**
     * クールダウン移行完了
     * CooldownSystem から通知
     */
    onCooldownCompleted(detail) {
        if (this.currentState !== SequenceState.COOLDOWN || detail.entityId !== this.currentActorId) {
            return;
        }

        // シーケンス完了
        const actorId = this.currentActorId;
        this._resetState();
        
        // 全体の完了を通知 (ActionExecutionSystemなどが購読してキューを処理)
        this.world.emit(GameEvents.ACTION_SEQUENCE_COMPLETED, { entityId: actorId });
    }

    _resetState() {
        this.currentState = SequenceState.IDLE;
        this.currentActorId = null;
    }
}