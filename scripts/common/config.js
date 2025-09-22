import { TeamID } from './constants.js';

export const CONFIG = {
    MAX_GAUGE: 100,
    UPDATE_INTERVAL: 20,
    PLAYERS_PER_TEAM: 3,
    PART_HP_BASE: 50,
            LEGS_HP_BONUS: 10,
        BASE_DAMAGE: 20,
    // ★新規: デバッグログの表示を制御するフラグ
    DEBUG: false, 
    // ★新規: クリティカルヒット関連の定数
    CRITICAL_HIT: {
        // 攻撃成功度とターゲット機動度の差を確率に変換する際の係数
        DIFFERENCE_FACTOR: 200, 
        // 特定の攻撃タイプに加算されるクリティカル率ボーナス
        TYPE_BONUS: {
            '殴る': 0.25,
            '狙い撃ち': 0.50,
        },
    },
    // ★新規: 時間調整関連の定数
    TIME_ADJUSTMENT: {
        MAX_MIGHT: 99, // ゲーム内の最大威力（基準値）
        MAX_SUCCESS: 99, // ゲーム内の最大成功（基準値）
        CHARGE_IMPACT_FACTOR: 1, // チャージ時間への影響係数
        COOLDOWN_IMPACT_FACTOR: 1 // クールダウン時間への影響係数
    },
    // ★新規: 計算式関連の定数を集約
    // ゲームバランス調整を容易にするため、ロジック内のマジックナンバーを外部設定化
    FORMULAS: {
        EVASION: {
            DIFFERENCE_DIVISOR: 200, // 回避計算式: (機動 - 成功) / この値
            BASE_CHANCE: 0.10,       // 回避計算式の基本確率
            MAX_CHANCE: 0.95         // 回避の最大確率
        },
        DEFENSE: {
            ARMOR_DIVISOR: 400,      // 防御計算式: 装甲 / この値
            BASE_CHANCE: 0.10,       // 防御計算式の基本確率
            MAX_CHANCE: 0.95         // 防御の最大確率
        }
    },
    // バトルフィールド関連の定数を集約
    BATTLEFIELD: {
        HOME_MARGIN_TEAM1: 0.05, // チーム1のホームポジションのX座標
        HOME_MARGIN_TEAM2: 0.95, // チーム2のホームポジションのX座標
        ACTION_LINE_TEAM1: 0.45, // チーム1のアクションライン
        ACTION_LINE_TEAM2: 0.55, // チーム2のアクションライン
        PLAYER_INITIAL_Y: 25,    // プレイヤーの初期Y座標
        PLAYER_Y_STEP: 25,       // プレイヤー間のY座標の間隔
    },
    TEAMS: {
        [TeamID.TEAM1]: { name: 'チーム 1', color: '#63b3ed', baseSpeed: 1.0, textColor: 'text-blue-300' },
        [TeamID.TEAM2]: { name: 'チーム 2', color: '#f56565', baseSpeed: 1.0, textColor: 'text-red-300' }
    },
    
};