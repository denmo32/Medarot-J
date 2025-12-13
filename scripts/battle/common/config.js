import { AttackType } from './constants.js';
import { CONFIG as COMMON_CONFIG } from '../../common/config.js';

/**
 * @file バトルシーンの設定値を一元管理するモジュール
 */
export const CONFIG = {
    // 共通設定を展開
    ...COMMON_CONFIG,

    // 基本設定
    MAX_GAUGE: 100,
    UPDATE_INTERVAL: 20,
    PLAYERS_PER_TEAM: 3,
    MAX_PLAYERS: 6,
    
    // クリティカルヒット関連の定数
    CRITICAL_HIT: {
        DIFFERENCE_FACTOR: 200, 
    },
    
    // 時間調整関連の定数
    TIME_ADJUSTMENT: {
        MAX_MIGHT: 99,
        MAX_SUCCESS: 99,
        CHARGE_IMPACT_FACTOR: 1,
        COOLDOWN_IMPACT_FACTOR: 1
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