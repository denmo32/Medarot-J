/**
 * @file BattleContext.js
 * @description バトルシーン全体の状態を一元管理するシングルトンコンポーネント。
 * 従来の4つのコンテキスト(BattlePhase, GameMode, UIState, BattleHistory)を統合し、
 * 状態管理の複雑さを軽減します。
 */
import { BattlePhase, TeamID } from '../common/constants.js';

export class BattleContext {
    constructor() {
        /**
         * @type {string} - 現在のバトルフェーズ (BattlePhase定数)
         * バトル全体の進行状況を管理します。
         */
        this.phase = BattlePhase.IDLE;

        /**
         * @type {string} - 現在のゲームモード ('map', 'battle', 'customize')
         */
        this.gameMode = 'battle';

        /**
         * @type {boolean} - UI操作などによりゲームのコアロジックが一時停止しているか
         */
        this.isPaused = false;

        /**
         * @type {object} - ターンとアクションに関する状態
         */
        this.turn = {
            /** @type {number} - 現在のターン数 */
            number: 0,
            /** @type {number | null} - 現在行動選択中のアクターID */
            currentActorId: null,
            /** @type {Array<number>} - このターンに行動する権利を持つエンティティのキュー */
            actionQueue: [],
            /** @type {Map<number, object>} - 選択されたアクションのマップ { entityId: actionData } */
            selectedActions: new Map(),
            /** @type {Array<object>} - このターンに実行・解決されたアクションの結果リスト */
            resolvedActions: [],
        };

        /**
         * @type {object} - AIの意思決定に使用される戦闘履歴データ
         */
        this.history = {
            teamLastAttack: {
                [TeamID.TEAM1]: { targetId: null, partKey: null },
                [TeamID.TEAM2]: { targetId: null, partKey: null }
            },
            leaderLastAttackedBy: {
                [TeamID.TEAM1]: null,
                [TeamID.TEAM2]: null
            }
        };

        /**
         * @type {string | null} - 勝利したチームのID
         */
        this.winningTeam = null;
    }
}