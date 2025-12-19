/**
 * @file PartComponents.js
 * @description パーツエンティティを構成するコンポーネント群。
 * パーツの能力、状態、所属情報を管理する。
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

/**
 * パーツのアクション定義情報
 */
export class PartAction {
    constructor(definition = {}) {
        this.actionType = definition.actionType; // 'SHOOT', 'MELEE', etc.
        this.subType = definition.type; // '射撃', '格闘' (表示用カテゴリ)
        this.targetTiming = definition.targetTiming; // 'pre-move', 'post-move'
        this.targetScope = definition.targetScope; // 'ENEMY_SINGLE', etc.
        this.postMoveTargeting = definition.postMoveTargeting; // 自動ターゲット戦略キー
        this.isSupport = definition.isSupport || false;
    }
}

/**
 * パーツの効果定義リスト（ダメージ、回復、バフなど）
 */
export class PartEffects {
    constructor(effects = []) {
        this.effects = effects; // Array of effect definition objects
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
 * @description 行動宣言時や効果発生時のメッセージ、アニメーションを定義。
 */
export class PartVisualConfig {
    /**
     * @param {object} config
     * @param {object} [config.declaration] - 行動宣言時の設定 { messageKey, animation, vfx }
     * @param {object} [config.effects] - 効果ごとの設定 { [EffectType]: { messageKey, animation, vfx } }
     */
    constructor(config = {}) {
        this.declaration = config.declaration || {};
        this.effects = config.effects || {};
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

/** 脚部タイプ判定用（戦車、多脚など。必要に応じて追加） */
export class LegType {
    constructor(type) {
        this.type = type;
    }
}