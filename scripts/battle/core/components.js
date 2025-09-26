import { CONFIG } from '../common/config.js';
import { PlayerStateType, PartType, GamePhaseType, TeamID } from '../common/constants.js';

// プレイヤーの基本情報
export class PlayerInfo {
    constructor(name, teamId, isLeader) {
        this.name = name;
        this.teamId = teamId;
        this.isLeader = isLeader;
        this.color = CONFIG.TEAMS[teamId].color;
    }
}

// ゲージ
export class Gauge {
    constructor() {
        this.value = 0;
        this.speedMultiplier = 1.0; // ★新規: パーツ性能に応じた速度補正率
        // speedプロパティは廃止され、GaugeSystemが直接脚部の推進力を参照する
        this.max = CONFIG.MAX_GAUGE;
    }
}

// ゲームの状態
export class GameState {
    // 状態の初期値を定数で指定
    constructor(initialState = PlayerStateType.CHARGING) {
        this.state = initialState; // charging, ready_select, selected_charging, ready_execute, cooldown_complete, broken
    }
}

// パーツ情報
export class Parts {
    /**
     * @param {object} head - 頭部パーツのマスターデータ
     * @param {object} rightArm - 右腕パーツのマスターデータ
     * @param {object} leftArm - 左腕パーツのマスターデータ
     * @param {object} legs - 脚部パーツのマスターデータ
     */
    constructor(head, rightArm, leftArm, legs) {
        /**
         * ★改善: マスターデータを元に、戦闘インスタンス用のパーツデータを生成します。
         * マスターデータ（設計図）と、戦闘中に変動する状態（HPなど）を明確に分離し、
         * データの不変性を保つことで、予期せぬバグを防ぎます。
         * @param {object} partData - パーツのマスターデータ
         * @returns {object | null} 戦闘インスタンス用のパーツオブジェクト、またはnull
         */
        const initializePart = (partData) => {
            if (!partData) return null;
            // マスターデータをコピーし、戦闘中に変動する状態を追加
            const partInstance = { ...partData };
            // HPは最大HPで初期化
            partInstance.hp = partData.maxHp;
            // 破壊状態は'false'で初期化
            partInstance.isBroken = false;
            return partInstance;
        };

        this.head = initializePart(head);
        this.rightArm = initializePart(rightArm);
        this.leftArm = initializePart(leftArm);
        this.legs = initializePart(legs);
    }
}

/**
 * DOM要素への参照を保持するコンポーネント
 * @class DOMReference
 * @description 
 * UI表示に必要なDOM要素への参照を保持します。
 * ECSアーキテクチャでは、エンティティがUI要素と関連付けられる場合に使用されます。
 * 
 * 注：このコンポーネントはUI層とゲームロジック層を結びつけるブリッジ的な役割を果たします。
 * より厳格な層分けを実現するには、このコンポーネントをUIシステム内でのみ使用し、
 * 他のゲームロジックシステムからは参照しないように構成することが望ましいですが、
 * 現在の実装ではいくつかのシステムがDOM要素を直接必要とするため、この形態を維持します。
 */
export class DOMReference {
    constructor() {
        this.iconElement = null;                    // アイコン表示用要素
        this.homeMarkerElement = null;              // ホームポジションのマーカー要素
        this.infoPanel = null;                      // 情報パネル要素
        this.partDOMElements = {};                  // パーツごとのDOM要素マッピング
        this.targetIndicatorElement = null;         // ターゲット表示用アニメーション要素
    }
}

/**
 * 戦闘アクションの情報を保持するコンポーネント
 * @class Action
 * @description 
 * アクションの種類、使用するパーツ、ターゲット情報を保持します。
 * 現在は攻撃アクションのみを想定していますが、将来的に移動アクションなども拡張できます。
 * 
 * 注：現在の実装では、攻撃の詳細（ターゲットやダメージ）とアクションの基本情報（種類、使用パーツ）
 * の2つの関心事がこの1つのコンポーネントに集約されています。完全な単一責任原則への準拠を
 * 行うには、このコンポーネントを複数のコンポーネントに分離できますが、現在のECSアーキテクチャ
 * との整合性を保つため、現時点ではこの形態を維持します。
 */
export class Action {
    constructor() {
        this.type = null;            // アクションの種類 ('格闘', '射撃'など)
        this.partKey = null;         // 使用するパーツのキー ('head', 'rightArm'など)
        this.targetId = null;        // ターゲットのエンティティID
        this.targetPartKey = null;   // ターゲットとして選択されたパーツのキー
    }
}

// 準備された攻撃
// ★廃止: Actionコンポーネントに統合されたため、このコンポーネントは不要になりました。
// export class Attack {
//     constructor() {
//         this.target = null;
//         this.partKey = null;
//         this.damage = 0;
//     }
// }

// バトルフィールド上の位置
export class Position {
    constructor(x, y) {
        this.x = x; // 0 to 1 ratio
        this.y = y; // v-pos in %
    }
}

// チーム情報
export class Team {
    constructor(id) {
        this.id = id;
        this.name = CONFIG.TEAMS[id].name;
    }
}

/**
 * ゲーム全体のグローバルな状態を管理するシングルトンコンポーネント
 * @class GameContext
 * @description 
 * このコンポーネントは複数の関心事を保持しています：
 * 1. ゲームモード管理（マップ/バトル）
 * 2. バトルフェーズ管理（ゲーム進行状態）
 * 3. モーダル表示制御（UI状態）
 * 4. ゲーム結果（勝利チーム）
 * 5. 戦闘履歴（AIロジック用）
 * 6. メッセージキュー（UI管理用）
 * 
 * 注：現在の実装では、複数の関心事がこの1つのコンポーネントに集約されています。
 * より完全な単一責任原則への準拠を行うには、このコンポーネントを複数の
 * シングルトンコンポーネントに分離できますが、ECSアーキテクチャとの整合性
 * および既存システムとの互換性の観点から、現時点ではこの形態を維持します。
 */
export class GameContext {
    constructor() {
        // ゲームモード管理
        this.gameMode = 'map';              // 'map' or 'battle'
        
        // バトルフェーズ管理
        this.battlePhase = GamePhaseType.IDLE;
        
        // UI状態管理
        this.isPausedByModal = false;       // モーダル表示によりゲーム進行が一時停止しているか
        this.messageQueue = [];             // モーダルの競合を避けるためのメッセージキュー
        
        // ゲーム結果
        this.winningTeam = null;            // 勝利したチームID

        // 戦闘履歴（AIロジック用）
        // 各チームの最後の攻撃情報を記録します (Assist性格用)
        this.teamLastAttack = {
            [TeamID.TEAM1]: { targetId: null, partKey: null },
            [TeamID.TEAM2]: { targetId: null, partKey: null }
        };
        // 各チームのリーダーを最後に攻撃した敵を記録します (Guard性格用)
        this.leaderLastAttackedBy = {
            [TeamID.TEAM1]: null,
            [TeamID.TEAM2]: null
        };
    }
}

/**
 * メダルの情報を保持するコンポーネント
 */
export class Medal {
    /**
     * @param {string} personality - メダルの性格 (例: 'LEADER_FOCUS', 'RANDOM')
     */
    constructor(personality) {
        this.personality = personality;
    }
}

/**
 * 個々のメダロットの戦闘履歴を記録するコンポーネント
 */
export class BattleLog {
    constructor() {
        // 最後に自分を攻撃してきた敵のID (Counter性格用)
        this.lastAttackedBy = null;
        // 自分が最後に行った攻撃の情報 (Focus性格用)
        this.lastAttack = {
            targetId: null,
            partKey: null
        };
    }
}