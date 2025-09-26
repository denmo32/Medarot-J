import { TeamID } from './constants.js';

/**
 * @file ゲーム全体の設定値を一元管理するモジュール
 * 全てのゲームバランスパラメータ、定数、設定値をここに定義することで、
 * ゲーム調整や拡張性の向上を図ります。
 */
export const CONFIG = {
    // 基本設定
    MAX_GAUGE: 100,              // ゲージの最大値
    UPDATE_INTERVAL: 20,         // ゲーム状態更新間隔（ミリ秒）
    PLAYERS_PER_TEAM: 3,         // 1チーム当たりのプレイヤー数
    MAX_PLAYERS: 6,              // 最大プレイヤー数（両チーム合わせて）
    
    // デバッグ設定
    DEBUG: false,                // デバッグモード有効化フラグ
    
    // クリティカルヒット関連の定数
    CRITICAL_HIT: {
        // 攻撃成功度とターゲット機動度の差を確率に変換する際の係数
        DIFFERENCE_FACTOR: 200, 
        // 特定の攻撃タイプに加算されるクリティカル率ボーナス
        TYPE_BONUS: {
            '殴る': 0.25,
            '狙い撃ち': 0.50,
        },
    },
    
    // 時間調整関連の定数（チャージ・クールダウン時間への影響）
    TIME_ADJUSTMENT: {
        MAX_MIGHT: 99,           // ゲーム内の最大威力（基準値）
        MAX_SUCCESS: 99,         // ゲーム内の最大成功（基準値）
        CHARGE_IMPACT_FACTOR: 1, // チャージ時間への影響係数
        COOLDOWN_IMPACT_FACTOR: 1 // クールダウン時間への影響係数
    },
    
    // 戦闘計算式のパラメータ
    FORMULAS: {
        // 回避計算式のパラメータ
        EVASION: {
            DIFFERENCE_DIVISOR: 200, // 回避計算式: (機動 - 成功) / この値
            BASE_CHANCE: 0.05,       // 回避計算式の基本確率
            MAX_CHANCE: 0.95         // 回避の最大確率
        },
        
        // 防御計算式のパラメータ
        DEFENSE: {
            ARMOR_DIVISOR: 4,        // 防御計算式: 装甲 / この値
            BASE_CHANCE: 0.05,       // 防御計算式の基本確率
            MAX_CHANCE: 0.95         // 防御の最大確率
        },
        
        // ダメージ計算式のパラメータ
        DAMAGE: {
            BASE_DAMAGE_DIVISOR: 4,  // ダメージ計算式: baseDamage / この値
            CRITICAL_MULTIPLIER: 1.5 // クリティカル時のダメージ倍率
        },
        
        // ゲージ増加計算式のパラメータ
        GAUGE: {
            GAUGE_INCREMENT_DIVISOR: 20.0 // ゲージ計算式: propulsion / この値
        }
    },
    
    // パーツタイプ別の補正値
    PART_TYPE_MODIFIERS: {
        '撃つ': {
            // '撃つ'タイプはチャージとクールダウンの両方の時間に影響する
            speedMultiplier: 0.75 // 補正率を0.75にする（25%短縮）
        },
        // 他のパーツタイプの補正値を追加する場合はここに記述
    },
    
    // バトルフィールド関連の定数
    BATTLEFIELD: {
        HOME_MARGIN_TEAM1: 0.05,      // チーム1のホームポジションのX座標
        HOME_MARGIN_TEAM2: 0.95,      // チーム2のホームポジションのX座標
        ACTION_LINE_TEAM1: 0.45,      // チーム1のアクションライン
        ACTION_LINE_TEAM2: 0.55,      // チーム2のアクションライン
        PLAYER_INITIAL_Y: 25,         // プレイヤーの初期Y座標
        PLAYER_Y_STEP: 25,            // プレイヤー間のY座標の間隔
        FIELD_WIDTH: 100,             // フィールドの幅（パーセンテージ）
        FIELD_HEIGHT: 100,            // フィールドの高さ（パーセンテージ）
        MAX_MOVEMENT_DISTANCE: 0.1,   // 1回の移動で移動できる最大距離（フィールド比率）
    },
    
    // ターンとフェーズ関連の設定
    TURN: {
        MAX_TURN_COUNT: 99,           // 最大ターン数
        PHASE_TRANSITION_DELAY: 500,  // フェーズ切替時の遅延時間（ミリ秒）
        SELECTION_TIME_LIMIT: 30000,  // 行動選択時間制限（ミリ秒）
    },
    
    // AI関連の設定
    AI: {
        DECISION_MAKING_DELAY: 1000,  // AIの意思決定待ち時間（ミリ秒）
        REACTION_TIME_VARIANCE: 0.2,  // AI反応時間のばらつき（倍率）
    },
    
    // チーム設定
    TEAMS: {
        [TeamID.TEAM1]: { 
            name: 'チーム 1', 
            color: '#63b3ed', 
            baseSpeed: 1.0, 
            textColor: 'text-blue-300',
            startPosition: 'left'       // チームの初期配置位置
        },
        [TeamID.TEAM2]: { 
            name: 'チーム 2', 
            color: '#f56565', 
            baseSpeed: 1.0, 
            textColor: 'text-red-300',
            startPosition: 'right'      // チームの初期配置位置
        },
    },
    
    // ゲームルール関連の設定
    RULES: {
        ALLOW_PART_DESTROY: true,      // パーツ破壊を許可するか
        ALLOW_TEAM_KO: true,           // チームの全滅による勝利を許可するか
        HOME_POSITION_BONUS: false,    // ホームポジションでの補正効果
        FRIENDLY_FIRE: false,          // チームメイトへのダメージ有効化
    },
};