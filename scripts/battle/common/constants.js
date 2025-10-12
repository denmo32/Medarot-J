/**
 * ゲーム全体の状態を定義する定数
 */
export const GamePhaseType = {
    IDLE: 'IDLE',
    INITIAL_SELECTION: 'INITIAL_SELECTION',
    BATTLE_START_CONFIRM: 'BATTLE_START_CONFIRM',
    PRE_BATTLE_ANIMATION: 'PRE_BATTLE_ANIMATION', // ★新規
    BATTLE: 'BATTLE',
    GAME_OVER: 'GAME_OVER'
};

/**
 * 各プレイヤーの状態を定義する定数
 */
export const PlayerStateType = {
    CHARGING: 'charging',
    READY_SELECT: 'ready_select',
    SELECTED_CHARGING: 'selected_charging',
    READY_EXECUTE: 'ready_execute',
    AWAITING_ANIMATION: 'awaiting_animation', // ★追加: 実行アニメーション待ち
    COOLDOWN_COMPLETE: 'cooldown_complete',
    BROKEN: 'broken'
};

/**
 * ★改善: パーツの部位に関する情報を一元管理する定数
 * 部位キー、日本語名、UIアイコンなどを集約し、情報の散逸を防ぎます。
 * これにより、関連情報の追加・変更がこのオブジェクトの修正のみで完結します。
 */
export const PartInfo = {
    HEAD:      { key: 'head',     name: '頭部', icon: '👤' },
    RIGHT_ARM: { key: 'rightArm', name: '右腕', icon: '🫷' },
    LEFT_ARM:  { key: 'leftArm',  name: '左腕', icon: '🫸' },
    LEGS:      { key: 'legs',     name: '脚部', icon: '👣' }
};

/**
 * パーツのキーを定義する定数 (PartInfoから自動生成)
 * 既存コードとの互換性と、キーへの直接アクセスを提供するために維持します。
 */
export const PartType = Object.values(PartInfo).reduce((acc, { key }) => {
    // 例: 'HEAD' -> 'head'
    const keyName = Object.keys(PartInfo).find(k => PartInfo[k].key === key);
    if (keyName) {
        acc[keyName] = key;
    }
    return acc;
}, {});

/**
 * ★新規: パーツキー(例: 'head')から対応するPartInfoオブジェクトを逆引きするためのマップ
 * これにより、動的なキー文字列から関連情報(名前、アイコン等)を効率的に取得できます。
 */
export const PartKeyToInfoMap = Object.values(PartInfo).reduce((acc, info) => {
    acc[info.key] = info;
    return acc;
}, {});

/**
 * チームIDを定義する定数
 */
export const TeamID = {
    TEAM1: 'team1',
    TEAM2: 'team2'
};

/**
 * メダルの性格タイプを定義する定数
 * これに基づいてターゲット選択のAIが分岐する
 */
export const MedalPersonality = {
    LEADER_FOCUS: 'LEADER_FOCUS', // 常にリーダーを狙う
    RANDOM: 'RANDOM',             // ターゲットをランダムに選択する
    HUNTER: 'HUNTER',             // 最も装甲が低いパーツを狙う
    CRUSHER: 'CRUSHER',           // 最も装甲が高いパーツを狙う
    JOKER: 'JOKER',               // 敵の全パーツからランダムに選択
    COUNTER: 'COUNTER',           // 自分を最後に攻撃してきた敵に反撃
    GUARD: 'GUARD',               // 味方リーダーを最後に攻撃してきた敵を狙う
    FOCUS: 'FOCUS',               // 前回攻撃したパーツを集中攻撃
    ASSIST: 'ASSIST',             // 味方が最後に攻撃した敵のパーツを狙う
    HEALER: 'HEALER',             // ★新規: 最もHPが減っている味方を狙う
};

/**
 * ★新規: アクションの効果種別を定義する定数
 * ActionSystemがこの定義を元に、effectStrategiesから適切な処理を呼び出します。
 */
export const EffectType = {
    DAMAGE: 'DAMAGE',           // ダメージを与える
    APPLY_SCAN: 'APPLY_SCAN',   // スキャン効果を適用する
    HEAL: 'HEAL',               // ★新規: 回復
    APPLY_GLITCH: 'APPLY_GLITCH', // ★新規: 妨害（グリッチ）
    // 今後追加予定の効果:
    // APPLY_SMOKE: 'APPLY_SMOKE', // 煙幕効果
    // SETUP_TRAP: 'SETUP_TRAP',   // トラップ設置
};

/**
 * ★新規: アクションの効果範囲を定義する定数
 * ターゲット選択や効果適用ロジックが、この定義を元に対象を決定します。
 */
export const EffectScope = {
    ENEMY_SINGLE: 'ENEMY_SINGLE', // 敵単体
    ALLY_SINGLE: 'ALLY_SINGLE',   // 味方単体
    ALLY_TEAM: 'ALLY_TEAM',     // 味方全体
    SELF: 'SELF',                 // 自分自身
    // 今後追加予定の範囲:
    // ENEMY_TEAM: 'ENEMY_TEAM',   // 敵全体
};

/**
 * ★廃止: PartInfoに統合されたため不要になりました。
 */
// export const PartNameJp = { ... };

/**
 * ★新規: モーダルの種類を定義する定数
 * これにより、コード内のマジックストリングを排除し、タイプミスによるバグを防ぎます。
 */
export const ModalType = {
    START_CONFIRM: 'start_confirm',
    SELECTION: 'selection',
    ATTACK_DECLARATION: 'attack_declaration',
    EXECUTION_RESULT: 'execution_result',
    BATTLE_START_CONFIRM: 'battle_start_confirm',
    GAME_OVER: 'game_over',
    MESSAGE: 'message'
};