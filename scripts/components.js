import { CONFIG } from './config.js';
import { PlayerStateType, PartType, GamePhaseType, TeamID } from './constants.js';

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
    constructor(speed) {
        this.value = 0;
        this.speed = speed;
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
    constructor() {
        const hp = CONFIG.PART_HP_BASE;
        const legsHp = hp + CONFIG.LEGS_HP_BONUS;
        this.head = { name: '頭部', hp, maxHp: hp, action: 'スキャン', power: 10, isBroken: false };
        this.rightArm = { name: '右腕', hp, maxHp: hp, action: '射撃', power: 20, isBroken: false };
        this.leftArm = { name: '左腕', hp, maxHp: hp, action: '格闘', power: 25, isBroken: false };
        this.legs = { name: '脚部', hp: legsHp, maxHp: legsHp, action: '移動', power: 0, isBroken: false };
    }
}

// DOM要素への参照
export class DOMReference {
    constructor() {
            this.iconElement = null;
            this.homeMarkerElement = null; // ホームポジションのマーカー要素
            this.infoPanel = null;
            this.partDOMElements = {};
        }
}

// 選択されたアクション。★Attackコンポーネントを統合し、ターゲットやダメージ情報もここに含める
export class Action {
    constructor() {
        this.type = null;       // '格闘', '射撃'など
        this.partKey = null;    // 'head', 'rightArm'など
        this.targetId = null;   // ★追加: ターゲットのエンティティID
        this.targetPartKey = null; // ★追加: ターゲットのパーツキー
        this.damage = 0;        // ★追加: 計算後のダメージ
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

// --- New: ゲーム全体のグローバルな状態を管理するシングルトンコンポーネント ---
export class GameContext {
    constructor() {
        this.phase = GamePhaseType.IDLE;
        // ★削除: activePlayerはUIの状態に依存するため、コアロジックから削除。
        // this.activePlayer = null; // 行動選択中または実行中のプレイヤー
        this.isPausedByModal = false; // モーダル表示により、ゲームの進行が一時停止しているか
        this.winningTeam = null; // 勝利したチームID

        // ★削除: 行動選択キューは、新設されたTurnSystemが責務を持つように変更。
        // this.actionQueue = [];

        // --- 戦闘履歴 ---
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

    // ★削除: isPausedメソッドは削除されました。
    // ゲームの進行可否は、GameFlowSystemが管理するGameContext.phaseによって一元的に判断されるように変更されました。
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