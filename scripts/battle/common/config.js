import { AttackType } from '../../common/constants.js';
import { CONFIG as COMMON_CONFIG } from '../../common/config.js';

/**
 * @file バトルシーンの設定値を一元管理するモジュール
 * 共通設定を継承しつつ、バトル固有の設定を追加定義します。
 */
export const CONFIG = {
    // 共通設定を展開
    ...COMMON_CONFIG,

    // 基本設定
    MAX_GAUGE: 100,              // ゲージの最大値
    UPDATE_INTERVAL: 20,         // ゲーム状態更新間隔（ミリ秒）
    PLAYERS_PER_TEAM: 3,         // 1チーム当たりのプレイヤー数
    MAX_PLAYERS: 6,              // 最大プレイヤー数（両チーム合わせて）
    
    // クリティカルヒット関連の定数
    CRITICAL_HIT: {
        DIFFERENCE_FACTOR: 200, 
        TYPE_BONUS: {
            [AttackType.STRIKE]: 0.25,
            [AttackType.AIMED_SHOT]: 0.50,
        },
    },
    
    // 時間調整関連の定数
    TIME_ADJUSTMENT: {
        MAX_MIGHT: 99,           // ゲーム内の最大威力（基準値）
        MAX_SUCCESS: 99,         // ゲーム内の最大成功（基準値）
        CHARGE_IMPACT_FACTOR: 1, // チャージ時間への影響係数
        COOLDOWN_IMPACT_FACTOR: 1 // クールダウン時間への影響係数
    },
    
    // 戦闘計算式のパラメータ
    FORMULAS: {
        EVASION: {
            DIFFERENCE_DIVISOR: 200,
            BASE_CHANCE: 0.05,
            MAX_CHANCE: 0.95
        },
        DEFENSE: {
            ARMOR_DIVISOR: 4,
            BASE_CHANCE: 0.05,
            MAX_CHANCE: 0.95
        },
        DAMAGE: {
            BASE_DAMAGE_DIVISOR: 4,
            CRITICAL_MULTIPLIER: 1.5
        },
        GAUGE: {
            GAUGE_INCREMENT_DIVISOR: 20.0,
            BASE_ACCELERATION: 0.1,
            BASE_MAX_SPEED: 0.5,
            MOBILITY_TO_ACCELERATION: 0.000001,
            PROPULSION_TO_MAX_SPEED: 0.1,
        }
    },
    
    // パーツタイプ別の補正値
    PART_TYPE_MODIFIERS: {
        [AttackType.SHOOT]: {
            speedMultiplier: 0.75
        },
    },
    
    // バトルフィールド関連の定数
    BATTLEFIELD: {
        HOME_MARGIN_TEAM1: 0.05,
        HOME_MARGIN_TEAM2: 0.95,
        ACTION_LINE_TEAM1: 0.45,
        ACTION_LINE_TEAM2: 0.55,
        PLAYER_INITIAL_Y: 20,
        PLAYER_Y_STEP: 30,
        FIELD_WIDTH: 100,
        FIELD_HEIGHT: 100,
        MAX_MOVEMENT_DISTANCE: 0.1,
    },
    
    // ターンとフェーズ関連の設定
    TURN: {
        MAX_TURN_COUNT: 99,
        PHASE_TRANSITION_DELAY: 500,
        SELECTION_TIME_LIMIT: 30000,
    },
    
    // AI関連の設定
    AI: {
        DECISION_MAKING_DELAY: 1000,
        REACTION_TIME_VARIANCE: 0.2,
    },
    
    // ゲームルール関連の設定
    RULES: {
        ALLOW_PART_DESTROY: true,
        ALLOW_TEAM_KO: true,
        HOME_POSITION_BONUS: false,
        FRIENDLY_FIRE: false,
    },
};