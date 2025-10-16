/**
 * @file 行動順序決定システム
 * このファイルは、ゲーム内でのエンティティ（キャラクター）の行動順を管理する責務を持ちます。
 */

import { BaseSystem } from '../../core/baseSystem.js';
import { GameState, PlayerInfo, Parts } from '../core/components/index.js'; // ★ Parts をインポート
import { BattlePhaseContext, UIStateContext } from '../core/index.js'; // Import new contexts
import { GameEvents } from '../common/events.js';
// ★変更: GamePhaseTypeをインポート
import { PlayerStateType, TeamID, GamePhaseType, PartInfo } from '../common/constants.js'; // ★ PartInfo をインポート
import { ErrorHandler } from '../utils/errorHandler.js';

/**
 * ゲームの「ターン」や行動順を管理するシステム。
 * なぜこのシステムが必要か？
 * 1. 責務の分離: 「誰が次に行動できるか」を決定するロジックは、エンティティの「状態」を管理するStateSystemから分離するべきです。
 *    これにより、各システムが単一の責任を持つことになり、コードがクリーンで理解しやすくなります。
 * 2. 柔軟なターン制御: 将来的に「素早さの高いキャラが連続で行動する」といった複雑なターン制御を導入する場合、
 *    このシステムにロジックを集約できるため、拡張が容易になります。
 */
export class TurnSystem extends BaseSystem {
    constructor(world) {
        super(world);
        
        // 行動選択の権利を得たエンティティが待機するキュー（待ち行列）。
        // このキューの先頭にいるエンティティが、次に行動を選択できます。
        this.actionQueue = [];
        
        // Use new context components for responsibilities
        this.battlePhaseContext = this.world.getSingletonComponent(BattlePhaseContext);
        this.uiStateContext = this.world.getSingletonComponent(UIStateContext);
        this.isPaused = false;  // ゲームの一時停止状態を管理
        
        // イベント購読
        this.world.on(GameEvents.GAME_PAUSED, this.onPauseGame.bind(this));
        this.world.on(GameEvents.GAME_RESUMED, this.onResumeGame.bind(this));

        // StateSystemなど、他のシステムからの要求に応じてキューを操作するためのイベントリスナーを登録します。
        this.world.on(GameEvents.ACTION_QUEUE_REQUEST, this.onActionQueueRequest.bind(this));
        this.world.on(GameEvents.ACTION_REQUEUE_REQUEST, this.onActionRequeueRequest.bind(this));
    }

    /**
     * StateSystemから「行動可能になった」という通知を受け、エンティティを行動キューの末尾に追加します。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onActionQueueRequest(detail) {
        const { entityId } = detail;
        // なぜ重複チェックが必要か？
        // StateSystemのupdateは毎フレーム実行されるため、行動可能なエンティティは何度もキュー追加要求を出す可能性があります。
        // このチェックにより、エンティティがキュー内に複数存在することを防ぎ、一度だけ行動権が与えられることを保証します。
        if (!this.actionQueue.includes(entityId)) {
            this.actionQueue.push(entityId);
        }
    }
    
    /**
     * StateSystemから「無効な行動が選択された」等の通知を受け、エンティティを行動キューの先頭に追加します。
     * なぜ「先頭」に追加するのか？
     * これはゲームデザイン上の決定です。無効な行動を選んでしまった場合に、ペナルティとしてターンを失うのではなく、
     * 即座に再選択の機会を与えるために、待機リストの先頭に割り込ませています。
     * @param {object} detail - イベント詳細 ({ entityId })
     */
    onActionRequeueRequest(detail) {
        const { entityId } = detail;
        if (!this.actionQueue.includes(entityId)) {
            this.actionQueue.unshift(entityId);
        }
    }

    /**
     * 毎フレーム実行され、行動キューを処理します。
     */
    update(deltaTime) {
        try {
            // ★変更: 初期行動選択フェーズとバトル中の両方で動作するように修正
            // これにより、ゲーム開始直後の行動選択が正しく開始され、かつゲームオーバー後には停止します。
            const activePhases = [GamePhaseType.BATTLE, GamePhaseType.INITIAL_SELECTION];
            if (!activePhases.includes(this.battlePhaseContext.battlePhase)) { // Use BattlePhaseContext
                return;
            }

            // キューに誰もいない、またはモーダル表示などでゲームが一時停止中の場合は、何も行いません。
            // isPausedByModalのチェックは、プレイヤーがUI操作中にターンが進行してしまうことを防ぐために重要です。
            if (this.actionQueue.length === 0 || this.isPaused) {
                return;
            }
            
            // キューの先頭からエンティティを取り出し、行動選択のプロセスを開始させます。
            const entityId = this.actionQueue.shift();

            // --- ▼▼▼ ここからがステップ3の変更箇所 ▼▼▼ ---
            // 念のため、取り出したエンティティがまだ行動可能か最終チェックを行います。
            const gameState = this.world.getComponent(entityId, GameState);
            const parts = this.world.getComponent(entityId, Parts);

            // ★修正: 状態が`READY_SELECT`でない、または頭部が破壊されている場合は行動不可
            if (gameState.state !== PlayerStateType.READY_SELECT || parts[PartInfo.HEAD.key]?.isBroken) {
                return; // 行動できない状態なら、何もせず次のフレームへ
            }
            // --- ▲▲▲ ステップ3の変更箇所ここまで ▲▲▲ ---
            
            const playerInfo = this.world.getComponent(entityId, PlayerInfo);
            
            // このシステムの役割は「交通整理」です。
            // チームIDに基づき、このターンがプレイヤーの操作対象か、AIの対象かを判断し、
            // それぞれInputSystemとAiSystemに「行動を選択してください」というイベントを発行して、処理を委譲します。
            const eventToEmit = playerInfo.teamId === TeamID.TEAM1 
                ? GameEvents.PLAYER_INPUT_REQUIRED 
                : GameEvents.AI_ACTION_REQUIRED;
            
            this.world.emit(eventToEmit, { entityId });
        } catch (error) {
            ErrorHandler.handle(error, { method: 'TurnSystem.update', deltaTime });
        }
    }
    
    // Game paused event handler
    onPauseGame() {
        this.isPaused = true;
    }
    
    // Game resumed event handler
    onResumeGame() {
        this.isPaused = false;
    }
}