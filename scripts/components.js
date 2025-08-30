import { CONFIG } from './config.js';
import { PlayerStateType, PartType, GamePhaseType } from './constants.js';

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
        this.head = { name: '頭部', hp, maxHp: hp, action: 'スキャン', isBroken: false };
        this.rightArm = { name: '右腕', hp, maxHp: hp, action: '射撃', isBroken: false };
        this.leftArm = { name: '左腕', hp, maxHp: hp, action: '格闘', isBroken: false };
        this.legs = { name: '脚部', hp: legsHp, maxHp: legsHp, action: '移動', isBroken: false };
    }
}

// DOM要素への参照
export class DOMReference {
    constructor() {
        this.iconElement = null;
        this.infoPanel = null;
        this.partDOMElements = {};
    }
}

// 選択されたアクション
export class Action {
    constructor() {
        this.type = null;
        this.partKey = null;
    }
}

// 準備された攻撃
export class Attack {
    constructor() {
        this.target = null;
        this.partKey = null;
        this.damage = 0;
    }
}

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
        this.activePlayer = null; // 行動選択中または実行中のプレイヤー
        this.isModalActive = false; // モーダルが表示されているか
        this.winningTeam = null; // 勝利したチームID
    }
}

