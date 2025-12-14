/**
 * @file WinConditionSystem.js
 * @description 勝敗判定を行うシステム。
 * イベント駆動を廃止し、フェーズとエンティティの状態監視による判定へ移行。
 */
import { System } from '../../../../engine/core/System.js';
import { PlayerInfo, Parts } from '../../../components/index.js';
import { TeamID } from '../../../common/constants.js';
import { BattlePhase } from '../../common/constants.js';
import { PhaseState, BattleResult, BattleSequenceState, SequencePending } from '../../components/index.js';
import { TargetingService } from '../../services/TargetingService.js';
import { GameEvents } from '../../../common/events.js';

export class WinConditionSystem extends System {
    constructor(world) {
        super(world);
        this.phaseState = this.world.getSingletonComponent(PhaseState);
    }

    update(deltaTime) {
        // 既にゲームオーバーなら何もしない
        if (this.phaseState.phase === BattlePhase.GAME_OVER) {
            return;
        }

        // 判定を行うべきタイミングかチェック
        // アクション実行フェーズ、またはターン終了時に判定を行う
        if (this.phaseState.phase !== BattlePhase.ACTION_EXECUTION && 
            this.phaseState.phase !== BattlePhase.TURN_END) {
            return;
        }

        // アクションシーケンス（アニメーション等）が実行中の場合は判定を保留する
        // これにより、爆発エフェクト等が終わってからゲームオーバーになる
        if (this._isSequenceRunning()) {
            return;
        }

        this._checkWinCondition();
    }

    _isSequenceRunning() {
        const activeSequences = this.getEntities(BattleSequenceState);
        const pendingSequences = this.getEntities(SequencePending);
        return activeSequences.length > 0 || pendingSequences.length > 0;
    }

    _checkWinCondition() {
        const players = this.getEntities(PlayerInfo, Parts);
        let team1Alive = false;
        let team2Alive = false;
        let team1LeaderAlive = false;
        let team2LeaderAlive = false;

        // 全プレイヤーの状態をスキャン
        for (const entityId of players) {
            const info = this.world.getComponent(entityId, PlayerInfo);
            const parts = this.world.getComponent(entityId, Parts);

            // 頭部が健在なら生存とみなす
            if (parts.head && !parts.head.isBroken) {
                if (info.teamId === TeamID.TEAM1) {
                    team1Alive = true;
                    if (info.isLeader) team1LeaderAlive = true;
                } else if (info.teamId === TeamID.TEAM2) {
                    team2Alive = true;
                    if (info.isLeader) team2LeaderAlive = true;
                }
            }
        }

        let winningTeam = null;

        // 判定ロジック: リーダー破壊 または チーム全滅
        if (!team1LeaderAlive || !team1Alive) {
            winningTeam = TeamID.TEAM2;
        } else if (!team2LeaderAlive || !team2Alive) {
            winningTeam = TeamID.TEAM1;
        }

        if (winningTeam) {
            this._triggerGameOver(winningTeam);
        }
    }

    _triggerGameOver(winningTeam) {
        // フェーズを更新
        this.phaseState.phase = BattlePhase.GAME_OVER;

        // 結果コンポーネントを作成 (GameFlowSystem等がこれを検知してUIを表示する)
        const resultEntity = this.world.createEntity();
        this.world.addComponent(resultEntity, new BattleResult(winningTeam));

        // 念のためイベントも発行（UI表示トリガー用としてGameFlowSystemが使用）
        // GameFlowSystemもポーリングに移行すればこのイベントも不要になるが、
        // UI遷移のトリガーとしてはイベントが自然な場合もある。
        // ここではGameFlowSystemのリファクタリングに合わせてイベント発行を残すが、
        // 本来はGameFlowSystemがBattleResultコンポーネントを検知すべき。
        this.world.emit(GameEvents.GAME_OVER, { winningTeam });
    }
}