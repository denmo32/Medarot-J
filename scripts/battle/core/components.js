import { CONFIG } from '../common/config.js';
import { PlayerStateType, PartType, GamePhaseType, TeamID } from '../common/constants.js';

// プレイヤーの基本情報
export class PlayerInfo {
    constructor(name, teamId, isLeader) {
        this.name = name;
        this.teamId = teamId;
        this.isLeader = isLeader;
        this.color = CONFIG.TEAMS[teamId].color;
        // ★削除: scanBonusプロパティはActiveEffectsコンポーネントで管理されるため不要
        // this.scanBonus = 0; 
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

            // ★リファクタリング: ロールのデフォルト値とパーツ固有の値をマージする
            // これにより、parts.jsの記述を簡潔に保ちつつ、完全なデータ構造を構築する
            // partData.roleが存在し、それがオブジェクトであることを確認
            const roleDefaults = (partData.role && typeof partData.role === 'object') ? { ...partData.role } : {};
            
            // マージの順序が重要: partDataがroleDefaultsを上書きする
            // これにより、パーツデータで定義された`effects`などがロールのデフォルトをオーバーライドできる
            const partInstance = { ...roleDefaults, ...partData };

            // HPはマスターデータから取得して初期化
            partInstance.hp = partData.maxHp;
            // 破壊状態は'false'で初期化
            partInstance.isBroken = false;
            
            // ★リファクタリング: effectの 'strategy' プロパティを 'type' に統一する
            // データ定義の互換性を保ちつつ、内部的には 'type' を使用する
            if (partInstance.effects && Array.isArray(partInstance.effects)) {
                partInstance.effects = partInstance.effects.map(effect => {
                    // strategyプロパティが存在すれば、typeにコピーして元のプロパティを削除
                    if (effect.strategy) {
                        const newEffect = { ...effect, type: effect.strategy };
                        delete newEffect.strategy;
                        return newEffect;
                    }
                    return effect;
                });
            }

            return partInstance;
        };

        this.head = initializePart(head);
        this.rightArm = initializePart(rightArm);
        this.leftArm = initializePart(leftArm);
        this.legs = initializePart(legs);
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
        this.properties = {};        // ★新規: アクションの特性 (targetTimingなど)
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

/**
 * ★新規: エンティティに適用されている効果（バフ・デバフ）を管理するコンポーネント
 */
export class ActiveEffects {
    constructor() {
        // 例: [{ type: 'SCAN', value: 5, duration: 3 }, { type: 'ATTACK_UP', value: 1.2, duration: 2 }]
        this.effects = [];
    }
}