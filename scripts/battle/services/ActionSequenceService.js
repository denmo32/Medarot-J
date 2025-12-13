/**
 * @file ActionSequenceService.js
 * @description アクション実行シーケンスのロジック制御。
 * キャンセル時はメッセージ表示後、強制移動はせずクールダウン状態へ遷移させる（自然な帰還を促す）。
 */
import { BattleResolutionService } from './BattleResolutionService.js';
import { CancellationService } from './CancellationService.js';
import { GameEvents } from '../../common/events.js';
import { PlayerStateType, ModalType } from '../common/constants.js';
import { GameState } from '../components/index.js';

export class ActionSequenceService {
    constructor(world) {
        this.world = world;
        this.battleResolver = new BattleResolutionService(world);
    }

    /**
     * @param {number} actorId 
     * @returns {{ visualSequence: Array, isCancelled: boolean, eventsToEmit: Array, stateUpdates: Array, actionUpdates: object }}
     */
    executeSequence(actorId) {
        // 基本的な状態遷移（アニメーション待機）
        const stateUpdates = [{
            type: 'TRANSITION_STATE',
            targetId: actorId,
            newState: PlayerStateType.AWAITING_ANIMATION
        }];

        // 1. キャンセルチェック (事前)
        const cancelCheck = CancellationService.checkCancellation(this.world, actorId);
        if (cancelCheck.shouldCancel) {
            return this._createCancelSequence(actorId, cancelCheck.reason, stateUpdates);
        }

        // 2. 戦闘結果の計算 (POST_MOVEターゲット解決もここに含まれる)
        const resultData = this.battleResolver.resolve(actorId);

        // 2.5. 解決後のキャンセルチェック (TargetingServiceなどでキャンセルされた場合)
        if (resultData.isCancelled) {
            const reason = resultData.cancelReason || 'INTERRUPTED';
            return this._createCancelSequence(actorId, reason, stateUpdates);
        }

        // 3. 解決結果からデータを構築 (タスク化はSystem側で行う)
        const visualSequence = resultData.visualSequence || [];

        // 状態変更コマンドを結果にマージ
        const finalStateUpdates = [...stateUpdates, ...(resultData.stateUpdates || [])];
        
        // POST_MOVEなどで更新されたアクション情報
        const actionUpdates = {
            entityId: actorId,
            targetId: resultData.targetId,
            targetPartKey: resultData.attackingPart ? resultData.attackingPart.targetPartKey : null // 戦闘結果に含まれる場合
        };

        return { 
            visualSequence,
            isCancelled: false, 
            eventsToEmit: resultData.eventsToEmit || [],
            stateUpdates: finalStateUpdates,
            actionUpdates
        };
    }

    /**
     * キャンセル時のシーケンス（メッセージ -> クールダウン移行）のデータを作成する
     */
    _createCancelSequence(actorId, reason, initialStateUpdates) {
        const visualSequence = [];
        const message = CancellationService.getCancelMessage(this.world, actorId, reason);
        
        // 1. メッセージ表示指示
        if (message) {
            visualSequence.push({
                type: 'DIALOG',
                text: message,
                options: { modalType: ModalType.MESSAGE }
            });
        }

        // 2. クールダウン状態へ移行するイベント発行指示
        // ApplyStateTaskを直接使うのではなく、コマンド実行イベントを発行する
        visualSequence.push({
            type: 'EVENT',
            eventName: GameEvents.EXECUTE_COMMANDS,
            detail: [{
                type: 'RESET_TO_COOLDOWN',
                targetId: actorId,
                options: { interrupted: true }
            }]
        });

        // ACTION_CANCELLED イベントは発行リストに含める
        const eventsToEmit = [{
            type: GameEvents.ACTION_CANCELLED,
            payload: { entityId: actorId, reason: reason }
        }];

        return { 
            visualSequence, 
            isCancelled: true, 
            eventsToEmit, 
            stateUpdates: initialStateUpdates // AWAITING_ANIMATION への遷移のみ即時実行
        };
    }
    
    getSortedReadyEntities() {
        // ECSの実装詳細に依存しすぎないよう、標準的な取得方法を使用
        // World.jsの実装に合わせて getEntitiesWith を使用
        const entities = this.world.getEntitiesWith(GameState); // ID配列
        
        // 準備完了エンティティを抽出
        const readyList = entities.filter(id => {
            const state = this.world.getComponent(id, GameState);
            return state.state === PlayerStateType.READY_EXECUTE;
        });

        // ソート（推進力順）
        readyList.sort((a, b) => {
            const partsA = this.world.getComponent(a, 'Parts'); // 文字列キーでの取得が可能なら
            const partsB = this.world.getComponent(b, 'Parts');
            // コンポーネントが取れない場合はフォールバック
            if (!partsA || !partsB) return 0;
            
            const propA = partsA.legs?.propulsion || 0;
            const propB = partsB.legs?.propulsion || 0;
            return propB - propA;
        });

        return readyList;
    }
}