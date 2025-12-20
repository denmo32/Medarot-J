/**
 * @file PartComponents.js
 * @description パーツエンティティを構成するコンポーネント群。
 * 振る舞い（Behavior）を細分化し、データ駆動設計を強化。
 */

/**
 * パーツの動的な状態（HP, 破壊状態）
 */
export class PartStatus {
    constructor(hp, maxHp) {
        this.hp = hp;
        this.maxHp = maxHp;
        this.isBroken = false;
    }
}

/**
 * パーツの静的なパラメータ（威力、成功、装甲など）
 */
export class PartStats {
    constructor(stats = {}) {
        this.name = stats.name || 'Unknown Part';
        this.icon = stats.icon || '';
        this.action = stats.action || ''; // 追加
        this.type = stats.type || ''; // 追加
        this.trait = stats.trait || ''; // 追加

        // 基本ステータス
        this.might = stats.might || 0;
        this.success = stats.success || 0;
        this.armor = stats.armor || 0;

        // 脚部専用ステータス
        this.mobility = stats.mobility || 0;
        this.propulsion = stats.propulsion || 0;
        this.stability = stats.stability || 0;
        this.defense = stats.defense || 0;
    }
}

// --- 振る舞い記述子 (Behavior Descriptors) ---

/** 
 * アクションの基本分類 
 */
export class ActionLogic {
    constructor(type, isSupport = false) {
        this.type = type; // 'SHOOT', 'MELEE', 'HEAL', etc.
        this.isSupport = isSupport;
    }
}

/** 
 * ターゲット選択の振る舞い 
 */
export class TargetingBehavior {
    constructor(config = {}) {
        this.timing = config.timing; // 'pre-move', 'post-move'
        this.scope = config.scope;   // 'ENEMY_SINGLE', 'ALLY_TEAM', etc.
        this.autoStrategy = config.autoStrategy; // 自動選択時のロジックID
    }
}

/** 
 * 命中計算の振る舞い 
 */
export class AccuracyBehavior {
    constructor(type = 'STANDARD') {
        this.type = type; // 'STANDARD' (成功vs機動), 'PERFECT' (必中), etc.
    }
}

/** 
 * 影響（効果発生）の振る舞い 
 */
export class ImpactBehavior {
    constructor(effects = []) {
        this.effects = effects; // [{type, calculation, params}]
    }
}

/**
 * パーツがどのメダロット（親エンティティ）に装備されているか
 */
export class AttachedToOwner {
    constructor(ownerId, partKey) {
        this.ownerId = ownerId;
        this.partKey = partKey; // 'head', 'rightArm', 'leftArm', 'legs'
    }
}

/**
 * パーツ固有の演出設定
 * @description 行動宣言時や効果発生時のメッセージテンプレートID、演出キーを保持。
 */
export class PartVisualConfig {
    /**
     * @param {object} config
     * @param {object} [config.declaration] - { templateId, animation }
     * @param {object} [config.impacts] - { [EffectType]: { templateId, animation, vfx } }
     */
    constructor(config = {}) {
        this.declaration = config.declaration || {};
        this.impacts = config.impacts || {};
    }
}

// --- 特性（Trait）タグコンポーネント ---

/** 貫通能力 */
export class TraitPenetrate { constructor() {} }

/** クリティカル補正 */
export class TraitCriticalBonus {
    constructor(rate) {
        this.rate = rate;
    }
}

/** ガード能力 */
export class TraitGuard {
    constructor(count) {
        this.count = count;
    }
}